import { useMemo } from 'react';

// Retro arcade colors - bright neons
const TEAM_COLORS = [
  '#00ff00', // Green (Matrix)
  '#ff00ff', // Magenta
  '#00ffff', // Cyan
  '#ffff00', // Yellow
  '#ff3333', // Red
  '#3333ff', // Blue
  '#ff8800', // Orange
  '#ffffff'  // White
];

export function useLineChartData(raceData, teams, timeInterval, showFromZero) {
  return useMemo(() => {
    if (!raceData || raceData.length === 0) return { labels: [], datasets: [] };

    const allDates = [...new Set(raceData.map(d => d.date))].sort();

    // Find the last date that has any HR data
    let lastValidDateIndex = allDates.length - 1;
    while (lastValidDateIndex > 0) {
      const date = allDates[lastValidDateIndex];
      const hasHRs = raceData.some(d => d.date === date && d.total_hrs > 0);
      if (hasHRs) break;
      lastValidDateIndex--;
    }

    const lastValidDate = allDates[lastValidDateIndex];

    // Filter dates based on selected time interval
    let filteredDates = [];
    if (timeInterval === 'week') {
      const oneWeekAgo = new Date(lastValidDate);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      filteredDates = allDates.filter(date => new Date(date) >= oneWeekAgo && date <= lastValidDate);
    } else if (timeInterval === 'month') {
      const oneMonthAgo = new Date(lastValidDate);
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
      filteredDates = allDates.filter(date => new Date(date) >= oneMonthAgo && date <= lastValidDate);
    } else {
      filteredDates = allDates.slice(0, lastValidDateIndex + 1);
    }

    // Format as M/D for display
    const dates = filteredDates.map(date => {
      const parts = date.split('-');
      return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
    });

    const teamNames = [...new Set(raceData.map(d => d.team_name))];

    const datasets = teamNames.map((teamName, index) => {
      const teamData = raceData.filter(d => d.team_name === teamName);
      const teamObj = teams.find(t => t.name === teamName);
      const managerName = teamObj ? teamObj.manager_name : '';

      teamData.sort((a, b) => new Date(a.date) - new Date(b.date));

      let startTotal = 0;
      if (timeInterval !== 'full' && filteredDates.length > 0 && !showFromZero) {
        const earliestDate = filteredDates[0];
        const earlierDates = allDates.filter(date => date < earliestDate);
        earlierDates.forEach(date => {
          const entry = teamData.find(d => d.date === date);
          if (entry) {
            startTotal += parseInt(entry.daily_hrs, 10);
          }
        });
      }

      let total = startTotal;
      const cumulativeData = filteredDates.map(date => {
        const entry = teamData.find(d => d.date === date);
        if (entry) {
          total += parseInt(entry.daily_hrs, 10);
          return total;
        }
        return null;
      });

      const color = TEAM_COLORS[index % TEAM_COLORS.length];

      return {
        label: `${managerName ? `${managerName}'s ` : ' '}${teamName}`,
        data: cumulativeData,
        borderColor: color,
        backgroundColor: color + '10',
        borderWidth: 1,
        pointRadius: 2,
        pointStyle: 'circle',
        pointBackgroundColor: color,
        tension: 0.1
      };
    });

    return { labels: dates, datasets };
  }, [raceData, teams, timeInterval, showFromZero]);
}

export function useBarChartData(raceData, teams) {
  return useMemo(() => {
    if (!raceData || raceData.length === 0) return { labels: [], datasets: [{ data: [] }] };

    const teamNames = [...new Set(raceData.map(d => d.team_name))];

    const teamColorMap = {};
    teamNames.forEach((teamName, index) => {
      teamColorMap[teamName] = TEAM_COLORS[index % TEAM_COLORS.length];
    });

    const teamLabels = teamNames.map(teamName => {
      const teamObj = teams.find(t => t.name === teamName);
      const managerName = teamObj ? teamObj.manager_name : '';
      return `${managerName ? `${managerName}'s ` : ' '}${teamName}`;
    });

    const teamTotals = teamNames.map(teamName => {
      const teamData = raceData.filter(d => d.team_name === teamName);
      return teamData.reduce((sum, day) => sum + parseInt(day.daily_hrs, 10), 0);
    });

    const teamDataPairs = teamLabels.map((label, index) => [
      label, teamTotals[index], teamNames[index]
    ]);
    teamDataPairs.sort((a, b) => b[1] - a[1]);

    return {
      labels: teamDataPairs.map(p => p[0]),
      datasets: [{
        data: teamDataPairs.map(p => p[1]),
        backgroundColor: teamDataPairs.map(p => teamColorMap[p[2]]),
        borderColor: '#000',
        borderWidth: 2,
        borderRadius: 0,
        barThickness: 30
      }]
    };
  }, [raceData, teams]);
}

export { TEAM_COLORS };
