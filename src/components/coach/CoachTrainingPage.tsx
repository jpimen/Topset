import { CoachPageHeader } from './CoachPageHeader';
import { AthleteCoachLinkCard } from '../athlete/AthleteCoachLinkCard';

export function CoachTrainingPage() {
  return <main className="coach-page">
    <CoachPageHeader eyebrow="COACH WORKSPACE / PERSONAL TRAINING" title="Train with a Coach" description="Request a training relationship with another Coach while keeping your Coach workspace." />
    <AthleteCoachLinkCard />
  </main>;
}
