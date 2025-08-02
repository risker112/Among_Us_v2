import { useEffect, useState } from 'react';

// Example player data (replace with real backend data or context)
const allPlayers = [
  { id: 1, character: 'ch1.png' },
  { id: 2, character: 'ch2.png' },
  { id: 3, character: 'ch3.png' },
  { id: 4, character: 'ch4.png' },
];

// Simulate current user (voter) character
const currentUserCharacter = 'ch2.png';

export default function Vote() {
  const [votes, setVotes] = useState({}); // {playerId: [voter1.png, voter2.png]}
  const [selected, setSelected] = useState(null); // Currently selected target

  // Toggle vote
  const handleVote = (playerId) => {
    if (selected === playerId) {
      // unselect
      setSelected(null);
      setVotes((prev) => {
        const updated = { ...prev };
        updated[playerId] = (updated[playerId] || []).filter(
          (ch) => ch !== currentUserCharacter
        );
        return updated;
      });
    } else {
      // select new vote
      if (selected !== null) {
        // Remove vote from previous target
        setVotes((prev) => {
          const updated = { ...prev };
          updated[selected] = (updated[selected] || []).filter(
            (ch) => ch !== currentUserCharacter
          );
          return updated;
        });
      }

      // Add vote to new target
      setSelected(playerId);
      setVotes((prev) => {
        const updated = { ...prev };
        if (!updated[playerId]) updated[playerId] = [];
        updated[playerId].push(currentUserCharacter);
        return updated;
      });
    }
  };

  const handlePass = () => {
    setSelected(null);
    setVotes((prev) => {
      const updated = { ...prev };
      for (const pid in updated) {
        updated[pid] = updated[pid].filter((ch) => ch !== currentUserCharacter);
      }
      return updated;
    });
  };

  return (
    <div className="w-full h-screen bg-black text-white p-4 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6">Vote</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 mb-8">
        {allPlayers.map((player) => (
          <div key={player.id} className="flex flex-col items-center space-y-2">
            <img
              src={`/src/assets/${player.character}`}
              alt="Player"
              className="w-20 h-20 object-contain"
            />
            <div
              className={`w-20 h-10 border-2 ${
                selected === player.id ? 'border-yellow-400' : 'border-gray-600'
              } rounded bg-gray-800 flex items-center justify-center cursor-pointer`}
              onClick={() => handleVote(player.id)}
            >
              <div className="flex space-x-1">
                {votes[player.id]?.map((voterChar, idx) => (
                  <img
                    key={idx}
                    src={`/src/assets/${voterChar}`}
                    alt="vote"
                    className="w-6 h-6"
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handlePass}
        className="bg-red-700 hover:bg-red-800 text-white px-6 py-3 rounded-full flex items-center gap-2"
      >
        ❌ Pass Vote
      </button>
    </div>
  );
}
