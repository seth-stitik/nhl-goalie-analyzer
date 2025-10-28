import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
const PORT = 5000;

app.get("/api/schedule", async (req, res) => {
  try {
    const response = await fetch("https://statsapi.web.nhl.com/api/v1/schedule");
    const data = await response.json();

    const games = data.dates[0]?.games || [];
    res.json(games);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.get("/api/goalies", async (req, res) => {
  try {
    // Step 1: Fetch today's schedule
    const scheduleRes = await fetch("https://statsapi.web.nhl.com/api/v1/schedule");
    const scheduleData = await scheduleRes.json();
    const games = scheduleData.dates[0]?.games || [];

    const goalieData = [];

    // Step 2: Loop through each game and get boxscore info
    for (const game of games) {
      const gamePk = game.gamePk;
      const boxRes = await fetch(`https://statsapi.web.nhl.com/api/v1/game/${gamePk}/boxscore`);
      const boxData = await boxRes.json();

      // Each team (home/away) has players
      const teams = ["home", "away"];
      for (const teamType of teams) {
        const players = Object.values(boxData.teams[teamType].players);
        const goalies = players.filter(p => p.position.code === "G");

        for (const goalie of goalies) {
          goalieData.push({
            team: boxData.teams[teamType].team.name,
            goalieName: goalie.person.fullName,
            goalieId: goalie.person.id,
            gamePk
          });
        }
      }
    }

    res.json(goalieData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch goalie data" });
  }
});

// --- Get detailed goalie stats ---
app.get("/api/goalie/:id/stats", async (req, res) => {
  const goalieId = req.params.id;
  try {
    const statsRes = await fetch(
      `https://statsapi.web.nhl.com/api/v1/people/${goalieId}/stats?stats=gameLog`
    );
    const statsData = await statsRes.json();

    const logs = statsData.stats[0]?.splits || [];

    // Filter to only games where the goalie allowed at least 1 goal
    const gamesWithGoalsAgainst = logs.filter(
      g => g.stat.goalsAgainst > 0
    );

    res.json({
      goalieId,
      gamesPlayed: logs.length,
      gamesWithGoalsAgainst
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch goalie stats" });
  }
});

// --- Get goal events from a specific game ---
app.get("/api/game/:gamePk/goals", async (req, res) => {
  const { gamePk } = req.params;

  try {
    const gameRes = await fetch(
      `https://statsapi.web.nhl.com/api/v1/game/${gamePk}/feed/live`
    );
    const gameData = await gameRes.json();

    const allPlays = gameData.liveData.plays.allPlays || [];

    // Filter only goal events
    const goalPlays = allPlays.filter(p => p.result.event === "Goal");

    const goals = goalPlays.map(g => {
      const scorer = g.players.find(p => p.playerType === "Scorer");
      const goalie = g.players.find(p => p.playerType === "Goalie");

      return {
        scorer: scorer?.player.fullName,
        scorerId: scorer?.player.id,
        scorerPosition: scorer?.playerType, // Usually "Scorer" but we’ll refine later
        team: g.team.name,
        goalie: goalie?.player.fullName,
        goalieId: goalie?.player.id,
        coordinates: g.coordinates || null
      };
    });

    res.json(goals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch goals for game" });
  }
});

// --- Analyze which side goals go in for each goalie ---
app.get("/api/game/:gamePk/goal-sides", async (req, res) => {
  const { gamePk } = req.params;

  try {
    const response = await fetch(`https://statsapi.web.nhl.com/api/v1/game/${gamePk}/feed/live`);
    const data = await response.json();
    const plays = data.liveData.plays.allPlays || [];

    const goalPlays = plays.filter(p => p.result.event === "Goal");

    const goalieSides = {};

    goalPlays.forEach(p => {
      const goalie = p.players.find(pl => pl.playerType === "Goalie")?.player?.fullName;
      const coords = p.coordinates;
      if (!goalie || !coords || coords.x === undefined || coords.y === undefined) return;

      let side;
      if (coords.x > 0) {
        side = coords.y > 0 ? "goalie-left" : "goalie-right";
      } else {
        side = coords.y > 0 ? "goalie-right" : "goalie-left";
      }

      if (!goalieSides[goalie]) {
        goalieSides[goalie] = { left: 0, right: 0, total: 0 };
      }

      goalieSides[goalie][side.includes("left") ? "left" : "right"] += 1;
      goalieSides[goalie].total += 1;
    });

    // Calculate which side is favored
    const analysis = Object.entries(goalieSides).map(([goalie, stats]) => {
      const favored =
        stats.left > stats.right
          ? "left side"
          : stats.right > stats.left
          ? "right side"
          : "even";
      return { goalie, ...stats, favored };
    });

    res.json(analysis);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to analyze goal sides" });
  }
});

