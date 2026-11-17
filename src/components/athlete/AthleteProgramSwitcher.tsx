import { NavLink } from 'react-router-dom';

export function AthleteProgramSwitcher() {
  return <nav className="athlete-program-switcher" aria-label="Choose a program">
    <NavLink to="/athlete/program" end className={({ isActive }) => isActive ? 'selected' : ''}>Linked program</NavLink>
    <NavLink to="/athlete/my-program" end className={({ isActive }) => isActive ? 'selected' : ''}>My program</NavLink>
  </nav>;
}
