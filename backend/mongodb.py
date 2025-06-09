from pymongo import MongoClient
from pymongo.operations import IndexModel
from datetime import datetime
from dotenv import load_dotenv
from bson import ObjectId
import os
import random
import uuid

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI)
db = client["shipyard"]

# Time series coll
if "sensor_data" not in db.list_collection_names():
    db.create_collection(
        "sensor_data",
        timeseries={"timeField": "timestamp", "metaField": "zone", "granularity": "minutes"}
    )
if "worker_behavior" not in db.list_collection_names():
    db.create_collection(
        "worker_behavior",
        timeseries={"timeField": "timestamp", "metaField": "workerId", "granularity": "minutes"}
    )

sensors = db["sensor_data"]
behavior = db["worker_behavior"]
workers = db["workers"]

def clean_mongo_docs(docs):
    def clean_value(val):
        if isinstance(val, ObjectId):
            return str(val)
        elif isinstance(val, datetime):
            return val.isoformat()
        elif isinstance(val, dict):
            return {k: clean_value(v) for k, v in val.items()}
        elif isinstance(val, list):
            return [clean_value(i) for i in val]
        else:
            return val

    return [clean_value(doc) for doc in docs]

def reset_database():
    db["workers"].delete_many({})
    db["worker_behavior"].delete_many({})
    db["sensor_data"].delete_many({})


def insert_worker_profiles(n=5):
    workers.delete_many({})
    for _ in range(n):
        doc = {
            "_id": f"W{random.randint(100,999)}",
            "name": f"Worker{random.randint(1,100)}",
            "role": random.choice(["Welder", "Inspector", "Painter"]),
            "risk_profile": {
                "avg_shortcut_rate": 0.0,
                "historical_decision_trends": []
            },
            "metadata": {
                "ppe_compliance": random.choice(["good", "moderate", "poor"]),
                "training_completed": ["confined space", "hazmat"]
            }
        }
        workers.insert_one(doc)

def simulate_batch_worker_events(policy, incentive, steps):
    run_id = str(uuid.uuid4())
    worker_list = list(workers.find())
    for _ in range(steps):
        for worker in worker_list:
            wid = worker["_id"]
            zone = random.choice(["Tank Zone", "Paint Bay", "Hull Bay"])
            temp = round(random.uniform(35, 48), 1)
            gas = "normal"

            sensors.insert_one({
                "run_id": run_id,
                "timestamp": datetime.utcnow(),
                "zone": zone,
                "temperature": temp,
                "gas": gas
            })

            base_prob = 0.5
            if policy == "strict": base_prob += 0.2
            if incentive == "high": base_prob += 0.2
            if policy == "lenient": base_prob -= 0.1
            if incentive == "low": base_prob -= 0.1

            decision = "followed_procedure" if random.random() < base_prob else "took_shortcut"
            payoff = 2 - 3 if decision == "took_shortcut" and policy == "strict" else 1 + (2 if incentive == "high" else 0)
            risk_score = round(random.uniform(0.6, 0.95), 2) if decision == "took_shortcut" else round(random.uniform(0.1, 0.5), 2)

            behavior.insert_one({
                "run_id": run_id,
                "workerId": wid,
                "timestamp": datetime.utcnow(),
                "decision": decision,
                "policy": policy,
                "incentive": incentive,
                "zone": zone,
                "environment": {"temperature": temp, "gas": gas},
                "computed": {"risk_score": risk_score, "payoff": payoff}
            })
        
    return run_id

def fetch_worker_behavior():
    return list(behavior.find())

def fetch_sensor_data():
    return list(sensors.find())

def fetch_workers():
    return list(workers.find())

def update_worker_trends():
    for worker in workers.find():
        wid = worker["_id"]
        pipeline = [
            {"$match": {"workerId": wid}},
            {"$group": {
                "_id": {"policy": "$policy", "incentive": "$incentive"},
                "total": {"$sum": 1},
                "shortcuts": {"$sum": {"$cond": [{"$eq": ["$decision", "took_shortcut"]}, 1, 0]}}
            }}
        ]
        result = list(behavior.aggregate(pipeline))
        trends = [{"policy": r["_id"]["policy"], "incentive": r["_id"]["incentive"],
                   "rate": round(r["shortcuts"] / r["total"], 2)} for r in result if r["total"] > 0]

        avg = sum(t["rate"] for t in trends) / len(trends) if trends else 0
        workers.update_one({"_id": wid}, {"$set": {
            "risk_profile.historical_decision_trends": trends,
            "risk_profile.avg_shortcut_rate": round(avg, 2)
        }})




def fetch_worker_behavior_by_run(run_id):
    return list(behavior.find({"run_id": run_id}))

def fetch_sensor_data_by_run(run_id):
    return list(sensors.find({"run_id": run_id}))



def fetch_one_worker_behavior():
    doc = behavior.find_one()
    return [doc] if doc else []

def fetch_one_sensor_data():
    doc = sensors.find_one()
    return [doc] if doc else []

def fetch_one_worker():
    doc = workers.find_one()
    return [doc] if doc else []