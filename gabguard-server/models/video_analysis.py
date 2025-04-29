import os
import tempfile
import subprocess
import openai
from pathlib import Path
from config_api import OpenAI_api
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure OpenAI API key
openai.api_key = OpenAI_api

async def analyze_video(video_file):
    try:
        # Create a temporary directory to store files
        with tempfile.TemporaryDirectory() as temp_dir:
            # Save the uploaded video to a temporary file
            temp_video_path = Path(temp_dir) / "temp_video.mp4"
            video_content = await video_file.read()
            with open(temp_video_path, "wb") as f:
                f.write(video_content)
            
            # Extract audio from the video
            temp_audio_path = Path(temp_dir) / "temp_audio.mp3"
            extract_audio_command = [
                "ffmpeg", "-i", str(temp_video_path), 
                "-q:a", "0", "-map", "a", str(temp_audio_path), "-y"
            ]
            subprocess.run(extract_audio_command, check=True, stderr=subprocess.PIPE)
            
            # Extract video frames (1 frame per second)
            temp_frames_dir = Path(temp_dir) / "frames"
            temp_frames_dir.mkdir(exist_ok=True)
            extract_frames_command = [
                "ffmpeg", "-i", str(temp_video_path),
                "-vf", "fps=1", f"{temp_frames_dir}/frame_%04d.jpg", "-y"
            ]
            subprocess.run(extract_frames_command, check=True, stderr=subprocess.PIPE)
            
            # Process audio with OpenAI
            audio_description = await analyze_audio_content(temp_audio_path)
            
            # Process video frames with OpenAI
            video_description = await analyze_visual_content(temp_frames_dir)
            
            # Combine analysis and determine toxicity score
            combined_result = await combine_analysis(video_description, audio_description)
            
            return combined_result
            
    except Exception as e:
        logger.error(f"Error analyzing video: {str(e)}")
        return {
            "description": "Error processing video",
            "toxicity_score": -1 
        }

async def analyze_audio_content(audio_path):
    try:
        # First transcribe the audio
        with open(audio_path, "rb") as audio_file:
            transcription = openai.Audio.transcribe(
                "whisper-1",
                audio_file
            )
            
        transcript_text = transcription["text"] if isinstance(transcription, dict) else transcription.text
        
        # Analyze the transcription for content and toxicity
        analysis_prompt = f"""
        Analyze the following audio transcript from a video:
        
        "{transcript_text}"
        
        Provide:
        1. A concise description of what is being discussed or said
        2. Identify any potentially toxic, harmful, offensive, or inappropriate content
        """
        
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an AI that analyzes audio transcripts for content and toxicity."},
                {"role": "user", "content": analysis_prompt}
            ]
        )
        
        analysis_content = response['choices'][0]['message']['content']
        
        return {
            "transcript": transcript_text,
            "analysis": analysis_content
        }
        
    except Exception as e:
        logger.error(f"Error analyzing audio: {str(e)}")
        return {
            "transcript": "",
            "analysis": "Error analyzing audio content"
        }

async def analyze_visual_content(frames_dir):
    try:
        # Get a sample of frames (first, middle, and last to represent the video)
        frame_files = sorted(list(frames_dir.glob("*.jpg")))
        
        if not frame_files:
            return {"analysis": "No frames extracted from video"}
        
        # Select representative frames (start, 1/4, middle, 3/4, end)
        if len(frame_files) >= 5:
            selected_frames = [
                frame_files[0],
                frame_files[len(frame_files) // 4],
                frame_files[len(frame_files) // 2],
                frame_files[3 * len(frame_files) // 4],
                frame_files[-1]
            ]
        else:
            # If fewer than 5 frames, use all available
            selected_frames = frame_files
        
        # Create base64 encoded images
        base64_images = []
        for frame in selected_frames:
            with open(frame, "rb") as img_file:
                image_data = img_file.read()
                import base64
                base64_image = base64.b64encode(image_data).decode('utf-8')
                base64_images.append(base64_image)
        
        # Create a prompt describing frames for GPT-4 Vision
        prompt = "Analyze these frames from a video. Describe what you see and identify any potentially toxic, harmful, offensive, or inappropriate content."
        
        # Call GPT-4 Vision API with the updated model name
        response = openai.ChatCompletion.create(
            model="gpt-4o",  # Updated from gpt-4-vision-preview
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI that analyzes video frames for content and potential toxicity."
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        *[{
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{img}"
                            }
                        } for img in base64_images]
                    ]
                }
            ],
            max_tokens=1000
        )
        
        analysis_content = response['choices'][0]['message']['content']
        
        return {
            "analysis": analysis_content
        }
        
    except Exception as e:
        logger.error(f"Error analyzing video frames: {str(e)}")
        return {
            "analysis": f"Error analyzing video frames: {str(e)}"
        }

async def combine_analysis(video_result, audio_result):
    try:
        # Step 1: Create the unified description
        combination_prompt = f"""
        Combine the following video and audio analysis from the same video into a coherent and detailed description.

        VIDEO ANALYSIS:
        {video_result.get('analysis', 'No video analysis available')}

        AUDIO ANALYSIS:
        Transcript: {audio_result.get('transcript', 'No transcript available')}
        Analysis: {audio_result.get('analysis', 'No audio analysis available')}

        Provide a detailed and emotionally accurate description of the video content, without holding back or softening the tone. 

        Describe:
        - What visually happens
        - What is said in the audio
        - The emotional tone (anger, threats, aggression, fear, etc.)
        - Any explicit, offensive, or inappropriate language
        - The overall impact the content may have on a viewer

        Be explicit where needed — include strong language if it appears. Do not sanitize or neutralize the content.
        Do not assign any scores — just describe the video as it is, including disturbing or offensive details.
        """
        
        description_response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an AI that writes detailed descriptions by combining visual and audio information."},
                {"role": "user", "content": combination_prompt}
            ]
        )
        
        description_content = description_response['choices'][0]['message']['content'].strip()

        # Step 2: Ask for toxicity score based on the description
        scoring_prompt = f"""
        Analyze the following description of a video:

        \"\"\"
        {description_content}
        \"\"\"

        Based solely on this description, assign a toxicity score between 0.0 and 1.0 where:
        - 0.0 means completely benign and appropriate
        - 1.0 means extremely toxic, harmful, or inappropriate

        Provide ONLY the numeric value (e.g., 0.35) without any extra explanation.
        """

        scoring_response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an AI that assigns toxicity scores to video content based on neutral descriptions."},
                {"role": "user", "content": scoring_prompt}
            ]
        )

        score_text = scoring_response['choices'][0]['message']['content'].strip()
        try:
            toxicity_score = float(score_text)
        except ValueError:
            toxicity_score = -1

        return {
            "description": description_content,
            "toxicity_score": toxicity_score
        }
        
    except Exception as e:
        logger.error(f"Error combining analysis: {str(e)}")
        return {
            "description": "Error combining video and audio analysis",
            "toxicity_score": -1
        }