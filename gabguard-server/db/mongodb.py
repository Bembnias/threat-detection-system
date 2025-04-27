from pymongo import MongoClient
from datetime import datetime, timedelta

client = None
db = None

def init_db():
    global client, db
    client = MongoClient("mongodb://localhost:27017/")
    db = client["gabguard"]

def report_violation(user_id, content, type, score):
    db.violations.insert_one({
        "user_id": user_id,
        "type": type,
        "content": content,
        "score": score,
        "timestamp": datetime.utcnow()
    })

def get_violations_by_user_and_days(user_id: str, days: int = 60):
    if db is None:
        init_db()
    time_ago = datetime.utcnow() - timedelta(days=days)
    query = {
        "user_id": user_id,
        "timestamp": {"$gte": time_ago}
    }
    violations_data = list(db.violations.find(query))
    for violation in violations_data:
        violation["_id"] = str(violation["_id"])
    return violations_data