from pymongo import MongoClient
from datetime import datetime

client = None
db = None

def init_db():
    global client, db
    client = MongoClient("mongodb://localhost:27017/")
    db = client["gabguard"]

def report_violation(user_id, content, type, score, label):
    db.violations.insert_one({
        "user_id": user_id,
        "type": type,
        "content": content,
        "score": score,
        "label": label,
        "timestamp": datetime.utcnow()
    })
