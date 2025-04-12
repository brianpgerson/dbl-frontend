import React from 'react';
import '../TeamSelector.css';

const TeamSelector = ({ teams, selectedTeam, onSelectTeam }) => {
  return (
    <div className="team-selector">
      <h3>Teams</h3>
      <ul style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', listStyleType: 'none' }}>
      <li 
          className={selectedTeam === null ? 'selected' : ''}
          onClick={() => onSelectTeam(null)}>
          All Teams
        </li>
      </ul>
      <ul>
        {teams.map(team => (
          <li 
            key={team.id}
            className={selectedTeam?.id === team.id ? 'selected' : ''}
            onClick={() => onSelectTeam(team)}>
            {team.manager_name}'s {team.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TeamSelector;