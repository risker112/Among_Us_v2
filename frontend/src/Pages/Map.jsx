import { useOutletContext, useNavigate } from 'react-router-dom';

export default function Map() {
  const { role } = useOutletContext();
  const navigate = useNavigate();

  return (
    <div className="relative w-full h-dvh overflow-hidden">
      {/* Responsive full-screen background map image */}
      <img
        src="/src/assets/map_full.png"
        alt="Map"
        className="absolute top-0 left-0 w-full h-full object-contain md:object-cover"
      />

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 bg-gray-800 text-white text-sm px-3 py-1.5 rounded shadow hover:bg-gray-700 z-10"
      >
        ⬅ Back
      </button>
    </div>
  );
}
