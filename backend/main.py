from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from mongodb import (
    insert_worker_profiles,
    simulate_batch_worker_events,
    fetch_worker_behavior,
    fetch_sensor_data,
    update_worker_trends,
    clean_mongo_docs,
    reset_database,
    fetch_workers,
    fetch_worker_behavior_by_run,
    fetch_sensor_data_by_run,
    fetch_one_worker_behavior,
    fetch_one_sensor_data,
    fetch_one_worker,
)

app = FastAPI()

# Allow CORS for local frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic models  ---

class GenerateWorkersParams(BaseModel):
    n: int

class SimulationParams(BaseModel):
    policy: str
    incentive: str
    steps: int

# --- Endpoints ---

@app.post("/generate_workers")
def generate_workers(params: GenerateWorkersParams):
    insert_worker_profiles(params.n)
    return {"status": "ok", "message": f"Generated {params.n} worker profiles."}

@app.post("/run_simulation")
def run_simulation(params: SimulationParams):
    run_id = simulate_batch_worker_events(params.policy, params.incentive, params.steps)
    update_worker_trends()
    return {"status": "ok", "message": "Simulation complete.", "run_id": run_id}


@app.get("/behavior/by_run/{run_id}")
def get_behavior_by_run(run_id: str):
    data = fetch_worker_behavior_by_run(run_id)
    return clean_mongo_docs(data)

@app.get("/sensor/by_run/{run_id}")
def get_sensor_by_run(run_id: str):
    data = fetch_sensor_data_by_run(run_id)
    return clean_mongo_docs(data)

@app.post("/reset")
def reset():
    reset_database()
    return {"status": "ok", "message": "Database reset."}

@app.get("/behavior")
def get_behavior():
    data = fetch_worker_behavior()
    return clean_mongo_docs(data)

@app.get("/sensor")
def get_sensor():
    data = fetch_sensor_data()
    return clean_mongo_docs(data)

@app.get("/workers")
def get_workers():
    data = fetch_workers()
    return clean_mongo_docs(data)



@app.get("/behavior/one")
def get_one_behavior():
    data = fetch_one_worker_behavior()
    return clean_mongo_docs(data)

@app.get("/sensor/one")
def get_one_sensor():
    data = fetch_one_sensor_data()
    return clean_mongo_docs(data)

@app.get("/workers/one")
def get_one_worker():
    data = fetch_one_worker()
    return clean_mongo_docs(data)