import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [goalies, setGoalies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGoalies = async () => {
      try {
        // 1️⃣ Get today's goalies
        const { data: goalieData } = await axios.get("/api/goalies");

        // 2️⃣ For each goalie, get stats and goal-side analysis
        const goalieDetails = await Promise.all(
          goalieData.map(async (g) => {
            // Fetch goalie stats
            const { data: statsData } = await axios.get(`/api/goalie/${g.goalieId}/stats`);

            // Fetch goal-side analysis for the game
            const { data: sideData } = await axios.get(`/api/game/${g.gamePk}/goal-sides`);

            const sideInfo = sideData.find((s) => s.goalie === g.goalieName) || {};

            return {
              ...g,
              gamesPlayed: statsData.gamesPlayed,
              gamesWithGoalsAgainst: statsData.gamesWithGoalsAgainst.length,
              sideFavored: sideInfo.favored || "N/A",
              left: sideInfo.left || 0,
              right: sideInfo.right || 0,
            };
          })
        );

        setGoalies(goalieDetails);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    fetchGoalies();
  }, []);

  if (loading) return <div className="App">Loading...</div>;

  return (
    <div className="App">
      <h1>Tonight's NHL Goalies</h1>
      <table>
        <thead>
          <tr>
            <th>Team</th>
            <th>Goalie</th>
            <th>Games Played</th>
            <th>Games with Goals Against</th>
            <th>Favored Side</th>
            <th>Left / Right Goals</th>
          </tr>
        </thead>
        <tbody>
          {goalies.map((g) => (
            <tr key={g.goalieId}>
              <td>{g.team}</td>
              <td>{g.goalieName}</td>
              <td>{g.gamesPlayed}</td>
              <td>{g.gamesWithGoalsAgainst}</td>
              <td>{g.sideFavored}</td>
              <td>
                {g.left} / {g.right}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
