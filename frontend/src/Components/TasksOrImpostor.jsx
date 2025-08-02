import { useOutletContext } from 'react-router-dom';
import Tasks from '../Components/Tasks';
import Impostor from '../Components/Impostor';

export default function TasksOrImpostor() {
  const { role } = useOutletContext();

  return (
    <div>
      {role === 'Impostor' ? <Impostor /> : <Tasks />}
    </div>
  );
}
