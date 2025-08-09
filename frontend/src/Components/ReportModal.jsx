import React, { useState } from 'react';
import { useSession } from '../SessionProvider.jsx';

function ReportModal({ players, onReport, onClose }) {
    const { session } = useSession();
    const [selectedPlayer, setSelectedPlayer] = useState(null);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Blur backdrop */}
        <div 
            className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm"
            onClick={onClose}
        />
        
        {/* Modal content */}
        <div className="relative bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold mb-4 text-center">Report Body</h2>
            <p className="text-gray-300 mb-6 text-center">
            Select who you want to report
            </p>
            
            <div className="max-h-96 overflow-y-auto mb-6">
            <ul className="space-y-3"> {/* Increased spacing */}
                {players.map((player) => (
                <li key={player.id} className="flex items-center gap-3"> {/* Flex layout */}
                    {/* Character image - same height as button */}
                    <div className="flex-shrink-0 w-14 h-14 rounded-full overflow-hidden border-2 border-gray-600">
                    <img 
                        src={`src/assets/characters/${player.character}`} 
                        alt={`${player.name}'s character`}
                        className={`w-full h-full object-cover ${player.ghost ? "grayscale" : ''}`}
                    />
                    </div>

                    {/* Button - now larger */}
                    <button
                    className={`flex-1 py-4 px-4 rounded text-left transition-colors ${
                        player.id === session.player_id
                        ? 'bg-gray-600 cursor-not-allowed opacity-70'
                        : selectedPlayer === player.id
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    onClick={() => player.id !== session.player_id && setSelectedPlayer(player.id)}
                    disabled={player.id === session.player_id || player.ghost}
                    >
                    <span className="text-lg font-medium"> {/* Larger text */}
                        {player.name}
                        {player.id === session.player_id && ' (You)'}
                    </span>
                    </button>
                </li>
                ))}
            </ul>
            </div>
            
            <div className="flex justify-center gap-4">
            <button
                className="px-6 py-2 bg-gray-600 rounded hover:bg-gray-500 transition-colors"
                onClick={onClose}
            >
                Cancel
            </button>
            <button
                className={`px-6 py-2 rounded transition-colors ${
                selectedPlayer
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-gray-500 cursor-not-allowed'
                }`}
                disabled={!selectedPlayer}
                onClick={() => onReport(selectedPlayer)}
            >
                REPORT
            </button>
            </div>
        </div>
        </div>
    );
}

export default ReportModal;