"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import Button from "@leafygreen-ui/button";
import Card from "@leafygreen-ui/card";
import { Select, Option } from "@leafygreen-ui/select";
import TextInput from "@leafygreen-ui/text-input";
import InfoWizard from "./components/InfoWizard";
import Modal from "@leafygreen-ui/modal";
import Icon from "@leafygreen-ui/icon";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

import {
  Cell,
  HeaderCell,
  HeaderRow,
  Row,
  Table,
  TableBody,
  TableHead,
} from "@leafygreen-ui/table";
import { H2, H3 } from "@leafygreen-ui/typography";

const API_URL = "api-rewrite";

export default function Home() {
  const [policy, setPolicy] = useState("strict");
  const [incentive, setIncentive] = useState("high");
  const [numWorkers, setNumWorkers] = useState(5);
  const [timesteps, setTimesteps] = useState(5);
  const [behavior, setBehavior] = useState([]);
  const [sensor, setSensor] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generateStatus, setGenerateStatus] = useState("");
  const [simulateStatus, setSimulateStatus] = useState("");
  const [resetStatus, setResetStatus] = useState("");
  const [openHelpModal, setOpenHelpModal] = useState(false);
  const [runId, setRunId] = useState(null);
  const [workerOptions, setWorkerOptions] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);

  const [riskHistory, setRiskHistory] = useState([]);
  const [sessionWorkerIds, setSessionWorkerIds] = useState([]);

  const [showModels, setShowModels] = useState(false);
  const [modelDocs, setModelDocs] = useState({
    worker: null,
    behavior: null,
    sensor: null,
  });
  const [modelsLoading, setModelsLoading] = useState(false);

  const fetchModels = async () => {
    setModelsLoading(true);
    try {
      const [behaviorRes, sensorRes, workerRes] = await Promise.all([
        axios.get(`${API_URL}/behavior/one`),
        axios.get(`${API_URL}/sensor/one`),
        axios.get(`${API_URL}/workers/one`),
      ]);
      setModelDocs({
        behavior: behaviorRes.data[0] || null,
        sensor: sensorRes.data[0] || null,
        worker: workerRes.data[0] || null,
      });
    } catch (err) {
      setModelDocs({
        behavior: "Error fetching",
        sensor: "Error fetching",
        worker: "Error fetching",
      });
    }
    setModelsLoading(false);
  };

  const handleShowModels = () => {
    setShowModels(true);
    fetchModels();
  };

  const fetchBehavior = async () => {
    const res = await axios.get(`${API_URL}/behavior`);
    console.log("Behavior data:", res.data); // <-- Add this
    setBehavior(res.data.reverse());
  };

  const fetchSensor = async () => {
    const res = await axios.get(`${API_URL}/sensor`);
    setSensor(res.data.reverse());
  };

  const handleGenerate = async () => {
    setLoading(true);
    setGenerateStatus("");
    setSimulateStatus("");
    setResetStatus("");
    try {
      const res = await axios.post(`${API_URL}/generate_workers`, {
        n: numWorkers,
      });
      await fetchBehavior();
      setGenerateStatus(res.data?.message || "Worker profiles created.");
    } catch (err) {
      setGenerateStatus("Failed to create worker profiles.");
    }
    setLoading(false);
  };
  const handleSimulate = async () => {
    setLoading(true);
    setGenerateStatus("");
    setSimulateStatus("");
    setResetStatus("");
    try {
      const res = await axios.post(`${API_URL}/run_simulation`, {
        policy,
        incentive,
        steps: timesteps,
      });
      const run_id = res.data.run_id;
      setRunId(run_id);

      // Fetch behavior for this run
      const behaviorRes = await axios.get(
        `${API_URL}/behavior/by_run/${run_id}`
      );
      setBehavior(behaviorRes.data);

      // extract unique worker IDs for dropdown and session
      const workers = [...new Set(behaviorRes.data.map((b) => b.workerId))];
      setWorkerOptions(workers.map((w) => ({ value: w, displayName: w })));
      setSelectedWorker(workers[0] || null);
      setSessionWorkerIds(workers);

      // get the latest timestamp from this runs behavior
      const runTimestamp =
        behaviorRes.data.length > 0
          ? behaviorRes.data
              .map((b) => new Date(b.timestamp?.$date || b.timestamp))
              .sort((a, b) => b - a)[0]
          : new Date();

      // Fetch all sensor data
      const sensorRes = await axios.get(`${API_URL}/sensor/by_run/${run_id}`);
      const grouped = {};
      sensorRes.data.forEach((row) => {
        const zone = row.zone;
        if (!grouped[zone]) grouped[zone] = [];
        grouped[zone].push(row);
      });
      const latestFivePerZone = Object.values(grouped).flatMap((zoneRows) =>
        zoneRows
          .sort(
            (a, b) =>
              new Date(b.timestamp?.$date || b.timestamp) -
              new Date(a.timestamp?.$date || a.timestamp)
          )
          .slice(0, 5)
      );
      setSensor(latestFivePerZone);

      setRiskHistory((prev) => [
        ...prev,
        ...behaviorRes.data.map((b) => ({
          runId: run_id,
          workerId: b.workerId,
          risk_score: b.computed?.risk_score ?? null,
          runTimestamp: runTimestamp,
        })),
      ]);

      setSimulateStatus(res.data?.message || "Simulation ran successfully.");
    } catch (err) {
      setSimulateStatus("Simulation failed.");
    }
    setLoading(false);
  };

  const handleReset = async () => {
    setLoading(true);
    setGenerateStatus("");
    setSimulateStatus("");
    setResetStatus("");
    try {
      const res = await axios.post(`${API_URL}/reset`);
      await fetchBehavior();
      await fetchSensor();
      setResetStatus(res.data?.message || "Database reset successful.");
    } catch (err) {
      setResetStatus("Database reset failed.");
    }
    setLoading(false);
  };

  // Bar chart
  const shortcutCount = behavior.filter(
    (b) => b.decision === "took_shortcut"
  ).length;
  const procedureCount = behavior.filter(
    (b) => b.decision === "followed_procedure"
  ).length;
  const shortcutBarData = [
    { name: "Shortcut", count: shortcutCount },
    { name: "Procedure", count: procedureCount },
  ];
  // Line chart

  useEffect(() => {
    if (runId && behavior.length > 0) {
      setRiskHistory((prev) => [
        ...prev,
        ...behavior.map((b) => ({
          runId,
          workerId: b.workerId,
          risk_score: b.computed?.risk_score ?? null,
        })),
      ]);
    }
    // eslint-disable-next-line
  }, [runId]);

  const workerIds = [...new Set(riskHistory.map((r) => r.workerId))];
  const runs = [...new Set(riskHistory.map((r) => r.runId))];
  const runTimestamps = runs.map(
    (run) => riskHistory.find((r) => r.runId === run)?.runTimestamp
  );

  const lineChartData = runs.map((run, idx) =>
    Object.fromEntries([
      [
        "timestamp",
        runTimestamps[idx] ? new Date(runTimestamps[idx]).toLocaleString() : "",
      ],
      ...sessionWorkerIds.map((wid) => [
        wid,
        riskHistory.find((r) => r.runId === run && r.workerId === wid)
          ?.risk_score ?? null,
      ]),
    ])
  );

  const showCharts = runId && behavior.length > 0;

  return (
    <div style={{ padding: 32 }}>
      <H2>Game Theoretic Shipyard Safety Simulation</H2>
      <Card style={{ marginBottom: 24 }}>
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            zIndex: 9999,
          }}
        >
          <div className="infowizard-container">
            <InfoWizard
              open={openHelpModal}
              setOpen={setOpenHelpModal}
              tooltipText="Tell me more!"
              iconGlyph="Wizard"
              sections={[
                {
                  heading: "Instructions and Talk Track",
                  content: [
                    {
                      heading: "Solution Overview",
                      body: "The Shipyard Safety Simulation Demo uses Game Theory to simulate worker behavior and environmental conditions in a shipyard setting. You can configure supervisor policy and incentive levels, generate synthetic worker profiles, and run a simulation to observe how workers behave under different conditions. The dashboard displays both worker actions and sensor data in real time, helping you explore the impact of different management strategies on safety outcomes.",
                    },
                    {
                      heading: "How to Demo",
                      body: [
                        "Select a Supervisor Policy and Incentive Level.",
                        "Set the number of Workers and Timesteps.",
                        "Click 'Generate Worker Profiles' to create synthetic workers.",
                        "Click 'Run Simulation' to simulate worker decisions and safety events.",
                        "View the Worker Behavior Overview and Sensor Data tables for results.",
                        "Status messages next to each button show the outcome of your actions.",
                      ],
                    },
                  ],
                },
                {
                  heading: "Behind the Scenes",
                  content: [
                    {
                      heading: "Logical Architecture",
                      body: "The frontend communicates with a backend API that manages simulation logic and data storage. Worker actions and sensor readings are stored in MongoDB, and the dashboard updates in real time as you interact with the simulation.",
                    },
                    {
                      image: {
                        src: "./info.png",
                        alt: "Logical Architecture",
                      },
                    },
                  ],
                },
                {
                  heading: "Why MongoDB?",
                  content: [
                    {
                      heading: "Flexible Data Model",
                      body: "MongoDB’s document-oriented architecture allows you to store varied data (such as worker profiles, behavior logs, and sensor outputs) in a unified format. This flexibility means you don’t have to redesign your database schema every time your data requirements evolve.",
                    },
                    {
                      heading: "Scalability and Performance",
                      body: "MongoDB is designed to scale horizontally, making it capable of handling large volumes of real-time data. This is essential when simulating multiple workers and sensors simultaneously.",
                    },
                    {
                      heading: "Real-Time Analytics",
                      body: "With powerful aggregation frameworks and change streams, MongoDB supports real-time data analysis and anomaly detection. This enables the system to process incoming simulation data on the fly and quickly surface critical safety insights.",
                    },
                    {
                      heading: "Seamless Integration",
                      body: "MongoDB integrates easily with modern backend frameworks, making it a robust choice for storing and querying simulation data.",
                    },
                  ],
                },
              ]}
            />
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            top: "60px",
            right: "20px",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          <Button
            variant="primary"
            onClick={handleShowModels}
            leftGlyph={<Icon glyph={"Database"} />}
            style={{ marginTop: 8 }}
          >
            Data Model
          </Button>
        </div>
        <Modal open={showModels} setOpen={setShowModels}>
          <div style={{ padding: 24, maxWidth: 600 }}>
            <H3>MongoDB Data Models (One Document Per Collection)</H3>
            {modelsLoading ? (
              <div>Loading...</div>
            ) : (
              <>
                <div>
                  <b>workers</b>
                  <pre
                    style={{
                      background: "#f6f8fa",
                      padding: 8,
                      borderRadius: 4,
                      fontSize: 13,
                    }}
                  >
                    {modelDocs.worker
                      ? JSON.stringify(modelDocs.worker, null, 2)
                      : "No data"}
                  </pre>
                </div>
                <div>
                  <b>worker_behavior</b>
                  <pre
                    style={{
                      background: "#f6f8fa",
                      padding: 8,
                      borderRadius: 4,
                      fontSize: 13,
                    }}
                  >
                    {modelDocs.behavior
                      ? JSON.stringify(modelDocs.behavior, null, 2)
                      : "No data"}
                  </pre>
                </div>
                <div>
                  <b>sensor_data</b>
                  <pre
                    style={{
                      background: "#f6f8fa",
                      padding: 8,
                      borderRadius: 4,
                      fontSize: 13,
                    }}
                  >
                    {modelDocs.sensor
                      ? JSON.stringify(modelDocs.sensor, null, 2)
                      : "No data"}
                  </pre>
                </div>
              </>
            )}
          </div>
        </Modal>
        <H3>Simulation Settings</H3>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "stretch",
            flexWrap: "wrap",
            marginTop: 16,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "180px 180px",
              gap: 16,
              minHeight: 160,
              height: 160,
            }}
          >
            <Select
              label="Supervisor Policy"
              value={policy}
              onChange={setPolicy}
              darkMode={false}
            >
              <Option value="strict">Strict</Option>
              <Option value="lenient">Lenient</Option>
            </Select>
            <Select
              label="Incentive Level"
              value={incentive}
              onChange={setIncentive}
              darkMode={false}
            >
              <Option value="high">High</Option>
              <Option value="low">Low</Option>
            </Select>
            <TextInput
              label="Workers"
              description="Enter number between 1 and 10"
              placeholder="5"
              onChange={(e) => setNumWorkers(Number(e.target.value))}
              value={numWorkers}
              style={{ width: "100%" }}
            />
            <TextInput
              label="Timesteps"
              description="Enter number between 1 and 20"
              placeholder="5"
              onChange={(e) => setTimesteps(Number(e.target.value))}
              value={timesteps}
              style={{ width: "100%" }}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginLeft: 52,
              justifyContent: "space-between",
              height: 175,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Button
                onClick={handleGenerate}
                disabled={loading}
                variant="baseGreen"
                style={{ width: 180 }}
              >
                Generate Worker Profiles
              </Button>
              <span style={{ fontSize: 13, color: "#007d1a", minWidth: 80 }}>
                {generateStatus}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Button
                onClick={handleSimulate}
                disabled={loading}
                variant="baseGreen"
                style={{ width: 180 }}
              >
                Run Simulation
              </Button>
              <span style={{ fontSize: 13, color: "#007d1a", minWidth: 80 }}>
                {simulateStatus}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Button
                onClick={handleReset}
                disabled={loading}
                variant="danger"
                style={{ width: 180 }}
              >
                Reset Database
              </Button>
              <span style={{ fontSize: 13, color: "#c00", minWidth: 80 }}>
                {resetStatus}
              </span>
            </div>
          </div>
        </div>

        {showCharts && (
          <div style={{ display: "flex", gap: 32, margin: "32px 0" }}>
            {/* Bar Chart */}
            <Card style={{ flex: 1, minWidth: 320, minHeight: 280 }}>
              <H3>Worker Decisions (Current Simulation)</H3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={shortcutBarData}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#007d1a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            {/* Line Chart */}
            <Card style={{ flex: 1, minWidth: 320, minHeight: 280 }}>
              <H3>Risk Profile Per Worker (This Session)</H3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  {sessionWorkerIds.map((wid, idx) => (
                    <Line
                      key={wid}
                      type="monotone"
                      dataKey={wid}
                      stroke={`hsl(${(idx * 60) % 360},70%,40%)`}
                      strokeWidth={3} // Thicker line
                      dot={{
                        r: 6,
                        fill: `hsl(${(idx * 60) % 360},70%,40%)`,
                        stroke: "#fff",
                        strokeWidth: 2,
                      }}
                      activeDot={{
                        r: 8,
                        fill: "#007d1a",
                        stroke: "#fff",
                        strokeWidth: 2,
                      }}
                      name={`Worker ${wid}`}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}
      </Card>
      <Card style={{ marginBottom: 24 }}>
        <H3>Worker Behavior Overview</H3>
        <Select
          label="Worker"
          value={selectedWorker}
          onChange={setSelectedWorker}
          darkMode={false}
          style={{ width: 180, marginBottom: 16 }}
        >
          {workerOptions.map((opt) => (
            <Option key={opt.value} value={opt.value}>
              {opt.displayName}
            </Option>
          ))}
        </Select>

        <Table>
          <TableHead>
            <HeaderRow>
              <HeaderCell>Worker</HeaderCell>
              <HeaderCell>Decision</HeaderCell>
              <HeaderCell>Policy</HeaderCell>
              <HeaderCell>Incentive</HeaderCell>
              <HeaderCell>Zone</HeaderCell>
              <HeaderCell>Risk Score</HeaderCell>
              <HeaderCell>Timestamp</HeaderCell>
            </HeaderRow>
          </TableHead>
          <TableBody>
            {behavior
              .filter((row) => row.workerId === selectedWorker)
              .map((row, idx) => (
                <Row key={row._id?.$oid || row._id || row.workerId || idx}>
                  <Cell>{row.workerId}</Cell>
                  <Cell>{row.decision}</Cell>
                  <Cell>{row.policy}</Cell>
                  <Cell>{row.incentive}</Cell>
                  <Cell>{row.zone}</Cell>
                  <Cell>
                    {row.computed && row.computed.risk_score
                      ? row.computed.risk_score
                      : ""}
                  </Cell>
                  <Cell>
                    {row.timestamp
                      ? new Date(
                          row.timestamp?.$date || row.timestamp
                        ).toLocaleString()
                      : ""}
                  </Cell>
                </Row>
              ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <H3>Sensor Data (Latest)</H3>
        <Table>
          <TableHead>
            <HeaderRow>
              <HeaderCell>Zone</HeaderCell>
              <HeaderCell>Temperature</HeaderCell>
              <HeaderCell>Gas</HeaderCell>
              <HeaderCell>Timestamp</HeaderCell>
            </HeaderRow>
          </TableHead>
          <TableBody>
            {sensor.map((row, idx) => (
              <Row key={row._id?.$oid || row._id || idx}>
                <Cell>{row.zone}</Cell>
                <Cell>{row.temperature}</Cell>
                <Cell>{row.gas}</Cell>
                <Cell>
                  {row.timestamp
                    ? new Date(
                        row.timestamp?.$date || row.timestamp
                      ).toLocaleString()
                    : ""}
                </Cell>
              </Row>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
