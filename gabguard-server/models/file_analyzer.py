import os
import json
import PyPDF2
import docx
import csv
from io import BytesIO
from typing import BinaryIO, Dict, Any
import magic
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from config_api import OpenAI_api
import openai
from models.video_analysis import analyze_video
from models.audio_analyzer import analyze_audio
from models.image_moderator import analyze_image

# Use API key from config
openai.api_key = OpenAI_api

async def analyze_file_content(file: BinaryIO, filename: str) -> Dict[str, Any]:
    """
    Analyze any file type and return content description and toxicity score.
    
    Args:
        file: File-like object containing the file data
        filename: Original filename with extension
    
    Returns:
        Dictionary with description and toxicity_score
    """
    try:
        file_content = file.read()
        mime_type = magic.from_buffer(file_content, mime=True)
        file_extension = os.path.splitext(filename)[1].lower()
        
        # Reset file pointer for later reading
        if hasattr(file, 'seek'):
            file.seek(0)
        else:
            file = BytesIO(file_content)
        
        # Handle video files with specialized video analysis module
        if mime_type.startswith('video/') or file_extension in ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.mpeg', '.3gp']:
            # Create a temporary file and pass it to video analysis
            with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
                temp_file.write(file_content)
                temp_path = temp_file.name
            
            try:
                # Create a FastAPI UploadFile-like object for analyze_video
                from fastapi import UploadFile
                import asyncio
                
                class MockUploadFile:
                    def __init__(self, path, filename):
                        self.file = open(path, 'rb')
                        self.filename = filename
                    
                    async def read(self):
                        return file_content
                    
                    def close(self):
                        self.file.close()
                
                mock_file = MockUploadFile(temp_path, filename)
                result = await analyze_video(mock_file)
                
                # Clean up temporary file
                mock_file.close()
                os.unlink(temp_path)
                
                return result
            except Exception as e:
                # If video analysis fails, fall back to generic analysis
                os.unlink(temp_path)
                return {
                    "description": f"Video file that could not be analyzed: {str(e)}",
                    "toxicity_score": 0.5,
                    "mime_type": mime_type,
                    "file_size": len(file_content)
                }
            
        # Handle audio files with specialized audio analysis module
        if mime_type.startswith('audio/') or file_extension in [".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"]:
            try:
                # Check file size - OpenAI API has a 25MB limit
                if len(file_content) > 25 * 1024 * 1024:  # 25 MB in bytes
                    return {
                        "description": f"Audio file is too large for analysis (size: {len(file_content) / (1024 * 1024):.2f} MB, limit: 25 MB). Consider compressing or trimming the file.",
                        "toxicity_score": 0.5,
                        "mime_type": mime_type,
                        "file_size": len(file_content)
                    }
                
                # Create a temporary file
                with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
                    temp_file.write(file_content)
                    temp_path = temp_file.name
                
                # Create a file-like object for analyze_audio
                with open(temp_path, 'rb') as audio_file:
                    # Call analyze_audio directly as it's imported from models.audio_analyzer
                    transcription, score, gpt_score = analyze_audio(audio_file)
                
                # Clean up temporary file
                os.unlink(temp_path)
                
                return {
                    "description": f"Audio file transcription: {transcription}",
                    "toxicity_score": score,
                    "ai_score": gpt_score,
                    "mime_type": mime_type,
                    "file_size": len(file_content)
                }
            except Exception as e:
                # If audio analysis fails, fall back to generic analysis
                error_msg = str(e)
                
                # Check for specific error messages
                if "Maximum content size limit" in error_msg:
                    return {
                        "description": f"Audio file is too large for analysis (limit: 25 MB). Please compress or trim the file.",
                        "toxicity_score": 0.5,
                        "mime_type": mime_type,
                        "file_size": len(file_content)
                    }
                
                return {
                    "description": f"Audio file that could not be analyzed: {error_msg}",
                    "toxicity_score": 0.5,
                    "mime_type": mime_type,
                    "file_size": len(file_content)
                }
                
        # Handle image files with specialized image analysis module
        if mime_type.startswith('image/') or file_extension in [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".svg"]:
            try:
                # Check file size - OpenAI API has a 20MB limit for images
                if len(file_content) > 20 * 1024 * 1024:  # 20 MB in bytes
                    return {
                        "description": f"Image file is too large for analysis (size: {len(file_content) / (1024 * 1024):.2f} MB, limit: 20 MB). Consider resizing or compressing the image.",
                        "toxicity_score": 0.5,
                        "mime_type": mime_type,
                        "file_size": len(file_content)
                    }
                
                # Analyze image directly using the analyze_image function
                result = await analyze_image(file_content)
                
                # Add additional metadata to the result
                result["mime_type"] = mime_type
                result["file_size"] = len(file_content)
                
                return result
            except Exception as e:
                error_msg = str(e)
                
                # Check for specific error messages
                if "Maximum content size limit" in error_msg:
                    return {
                        "description": f"Image file is too large for analysis (limit: 20 MB). Please resize or compress the image.",
                        "toxicity_score": 0.5,
                        "mime_type": mime_type,
                        "file_size": len(file_content)
                    }
                    
                # If image analysis fails, fall back to generic analysis
                return {
                    "description": f"Image file that could not be analyzed: {error_msg}",
                    "toxicity_score": 0.5,
                    "mime_type": mime_type,
                    "file_size": len(file_content)
                }
        
        # Extract content based on file type for non-video/non-audio/non-image files
        extracted_text = await extract_content(file, file_content, mime_type, file_extension)
        
        # If we couldn't extract any text, return a generic message
        if not extracted_text:
            extracted_text = f"Binary file of type {mime_type} with size {len(file_content)} bytes"
        
        # Get content description from GPT-4o
        description = await get_gpt_description(extracted_text, mime_type)
        
        # Get toxicity score from GPT-4o based on the description
        toxicity_score = await get_gpt_toxicity_score(description)
        
        return {
            "description": description,
            "toxicity_score": toxicity_score,
            "mime_type": mime_type,
            "file_size": len(file_content)
        }
    
    except Exception as e:
        return {
            "description": f"Error analyzing file: {str(e)}",
            "toxicity_score": 0.5,  # Default middle score
            "mime_type": "unknown",
            "file_size": 0
        }

async def extract_content(file: BinaryIO, file_content: bytes, mime_type: str, file_extension: str) -> str:
    """Extract text content from various file types."""
    
    # Text files
    if mime_type.startswith("text/") or file_extension in ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.css', '.js']:
        try:
            # Try to decode as UTF-8
            return file_content.decode('utf-8', errors='replace')
        except:
            return file_content.decode('latin-1', errors='replace')
    
    # PDF files
    elif mime_type == 'application/pdf' or file_extension == '.pdf':
        return extract_pdf_content(BytesIO(file_content))
    
    # Word documents
    elif mime_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' or file_extension == '.docx':
        return extract_docx_content(BytesIO(file_content))
    
    # CSV files
    elif mime_type == 'text/csv' or file_extension == '.csv':
        return extract_csv_content(BytesIO(file_content))
    
    # JSON files
    elif mime_type == 'application/json' or file_extension == '.json':
        try:
            data = json.loads(file_content.decode('utf-8', errors='replace'))
            return json.dumps(data, indent=2)
        except:
            return file_content.decode('utf-8', errors='replace')
    
    # XML files
    elif mime_type == 'application/xml' or mime_type == 'text/xml' or file_extension == '.xml':
        try:
            return extract_xml_content(BytesIO(file_content))
        except:
            return file_content.decode('utf-8', errors='replace')
    
    # ZIP files
    elif mime_type == 'application/zip' or file_extension in ['.zip', '.jar']:
        return extract_zip_content(BytesIO(file_content))
    
    # Video files - just return the MIME type and file size
    elif mime_type.startswith('video/'):
        return f"{mime_type} file with size {len(file_content)} bytes"
    
    # Binary or unknown files
    else:
        # Try to extract any text
        try:
            # Try to decode the first 8KB to see if there's any readable text
            sample = file_content[:8192].decode('utf-8', errors='replace')
            if any(c.isalpha() for c in sample):
                return sample + "... (content truncated)"
            else:
                return f"Binary file of type {mime_type} with size {len(file_content)} bytes"
        except:
            return f"Binary file of type {mime_type} with size {len(file_content)} bytes"

def extract_pdf_content(file_content: BytesIO) -> str:
    """Extract text from PDF files."""
    try:
        reader = PyPDF2.PdfReader(file_content)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        
        # If PDF extraction failed (empty text), return a note
        if not text.strip():
            return "PDF document with no extractable text (possibly scanned document)"
        
        # Limit text length
        if len(text) > 10000:
            return text[:10000] + "... (content truncated)"
        
        return text
    except Exception as e:
        return f"PDF document that could not be parsed: {str(e)}"

def extract_docx_content(file_content: BytesIO) -> str:
    """Extract text from DOCX files."""
    try:
        doc = docx.Document(file_content)
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        
        # Limit text length
        if len(text) > 10000:
            return text[:10000] + "... (content truncated)"
        
        return text
    except Exception as e:
        return f"Word document that could not be parsed: {str(e)}"

def extract_csv_content(file_content: BytesIO) -> str:
    """Extract text from CSV files."""
    try:
        file_content.seek(0)
        reader = csv.reader(file_content.read().decode('utf-8', errors='replace').splitlines())
        
        # Get first 100 rows maximum
        rows = []
        for i, row in enumerate(reader):
            if i >= 100:
                rows.append("... (content truncated)")
                break
            rows.append(",".join(row))
        
        return "\n".join(rows)
    except Exception as e:
        return f"CSV file that could not be parsed: {str(e)}"

def extract_xml_content(file_content: BytesIO) -> str:
    """Extract and format XML content."""
    try:
        tree = ET.parse(file_content)
        root = tree.getroot()
        
        # Format the XML with indentation - this is a simple representation
        def format_element(element, level=0):
            result = " " * level + f"<{element.tag}"
            
            # Add attributes
            for key, value in element.attrib.items():
                result += f' {key}="{value}"'
            
            # Check if there are child elements
            children = list(element)
            if not children and not element.text:
                result += "/>\n"
                return result
            
            result += ">\n"
            
            # Add text content if present
            if element.text and element.text.strip():
                result += " " * (level + 2) + element.text.strip() + "\n"
            
            # Add children recursively
            for child in children:
                result += format_element(child, level + 2)
            
            # Close tag
            result += " " * level + f"</{element.tag}>\n"
            return result
        
        formatted_xml = format_element(root)
        
        # Limit text length
        if len(formatted_xml) > 10000:
            return formatted_xml[:10000] + "... (content truncated)"
        
        return formatted_xml
    except Exception as e:
        return f"XML file that could not be parsed: {str(e)}"

def extract_zip_content(file_content: BytesIO) -> str:
    """List contents of ZIP files."""
    try:
        with zipfile.ZipFile(file_content) as z:
            file_list = z.namelist()
            
            # Limit number of files shown
            if len(file_list) > 100:
                file_list = file_list[:100]
                file_list.append("... (additional files not shown)")
            
            return "ZIP archive containing:\n" + "\n".join(file_list)
    except Exception as e:
        return f"ZIP file that could not be parsed: {str(e)}"

async def get_gpt_description(content: str, mime_type: str) -> str:
    """
    Get a description of the file content from GPT-4o.
    
    Args:
        content: Extracted text from the file
        mime_type: MIME type of the file
    
    Returns:
        A description of the file content
    """
    # Truncate content if it's too long (GPT-4o has token limits)
    max_content_length = 8000  # Adjust based on your needs
    if len(content) > max_content_length:
        content = content[:max_content_length] + "... (content truncated)"
    
    try:
        # Prepare the prompt for GPT
        prompt = f"""You are an AI that analyzes file content.

This is the content of a file with MIME type: {mime_type}.

Describe the value or content that this file represents in 3-5 sentences. Focus on the main purpose and content of the file. If the file content is short, display it in its entirety.

File content:
{content}"""
        
        # Make the API call using openai package
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an AI that analyzes file content. Provide a concise description (3-5 sentences) of what the file contains or what it appears to be."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=300,
            temperature=0.2
        )
        
        # Extract the response
        if response and "choices" in response and len(response["choices"]) > 0:
            return response["choices"][0]["message"]["content"].strip()
        else:
            return "Error: Unable to generate description from the content."
    
    except Exception as e:
        return f"Error generating description: {str(e)}"

async def get_gpt_toxicity_score(description: str) -> float:
    """
    Get a toxicity score for the content description from GPT-4o.
    
    Args:
        description: Description of the file content
    
    Returns:
        Toxicity score from 0 to 1
    """
    try:
        # Prepare the prompt for toxicity evaluation
        prompt = f"""Evaluate the toxicity of this content description:

{description}

Rate the toxicity on a scale from 0 to 1, where:
- 0: Completely harmless and appropriate content
- 0.25: Slightly concerning but generally appropriate content
- 0.5: Moderately concerning content that may be inappropriate in some contexts
- 0.75: Highly concerning content that is inappropriate in most contexts
- 1: Extremely toxic, harmful, illegal, or dangerous content

Return ONLY a single decimal number between 0 and 1 representing the toxicity score.
Toxicity score (0-1):"""
        
        # Make the API call using openai package
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an AI that evaluates content for toxicity. You respond only with a number between 0 and 1."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=10,
            temperature=0.1
        )
        
        if "choices" in response and len(response["choices"]) > 0:
            # Extract just the number from the response
            score_text = response["choices"][0]["message"]["content"].strip()
            
            # Try to extract a float from the response
            import re
            score_match = re.search(r"([0-9]*\.?[0-9]+)", score_text)
            if score_match:
                score = float(score_match.group(1))
                # Ensure score is within bounds
                return max(0.0, min(1.0, score))
            else:
                return 0.5  # Default middle score
        else:
            return 0.5  # Default middle score
    
    except Exception as e:
        print(f"Error getting toxicity score: {str(e)}")
        return 0.5  # Default middle score