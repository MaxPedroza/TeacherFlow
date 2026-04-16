import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, BadgeDollarSign, Settings } from 'lucide-react';
import './BottomNav.scss';

const BottomNav = () => {
  return (
    <nav className="bottom-nav">
      <NavLink to="/dashboard" className={({ isActive }) => 
        `bottom-nav__link ${isActive ? 'bottom-nav__link--active' : ''}`
      }>
        <LayoutDashboard size={20} />
        <label>Dashboard</label>
      </NavLink>
      <NavLink to="/agenda" className={({ isActive }) => 
        `bottom-nav__link ${isActive ? 'bottom-nav__link--active' : ''}`
      }>
        <Calendar size={20} />
        <label>Agenda</label>
      </NavLink>
      <NavLink to="/alunos" className={({ isActive }) => 
        `bottom-nav__link ${isActive ? 'bottom-nav__link--active' : ''}`
      }>
        <Users size={20} />
        <label>Alunos</label>
      </NavLink>
      <NavLink to="/financeiro" className={({ isActive }) => 
        `bottom-nav__link ${isActive ? 'bottom-nav__link--active' : ''}`
      }>
        <BadgeDollarSign size={20} />
        <label>Financeiro</label>
      </NavLink>
      <NavLink to="/configuracoes" className={({ isActive }) => 
        `bottom-nav__link ${isActive ? 'bottom-nav__link--active' : ''}`
      }>
        <Settings size={20} />
        <label>Ajustes</label>
      </NavLink>
    </nav>
  );
};

export default BottomNav;