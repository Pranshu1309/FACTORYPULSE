import { useMemo, useState, useEffect } from 'react';
import { Activity, AlertTriangle, ArrowDownRight, Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, Factory, Gauge, LayoutDashboard, Menu, Settings, ShieldCheck, Sparkles, Users, UserRound, Wrench, Moon, Sun } from 'lucide-react';
import { useFactoryData } from './context/FactoryContext.jsx';

export const initialData = {
  shift: 'Morning',
  workers: [
    { id: 'w1', name: 'Ravi Kumar', short: 'RK', shift: 'Morning', present: true, incidentCount: 0, skills: { CNC: 3, Welding: 1 } },
    { id: 'w2', name: 'Sunil Patel', short: 'SP', shift: 'Morning', present: true, incidentCount: 1, skills: { CNC: 2, Assembly: 2 } },
    { id: 'w3', name: 'Meena Devi', short: 'MD', shift: 'Morning', present: true, incidentCount: 0, skills: { Welding: 3, Quality: 2 } },
    { id: 'w4', name: 'Arjun Singh', short: 'AS', shift: 'Morning', present: true, incidentCount: 2, skills: { Assembly: 3, CNC: 1 } },
    { id: 'w5', name: 'Priya Sharma', short: 'PS', shift: 'Afternoon', present: true, incidentCount: 0, skills: { Quality: 3, CNC: 2 } },
    { id: 'w6', name: 'Imran Khan', short: 'IK', shift: 'Afternoon', present: true, incidentCount: 1, skills: { Welding: 2, Assembly: 2 } },
    { id: 'w7', name: 'Kavita Rao', short: 'KR', shift: 'Afternoon', present: true, incidentCount: 0, skills: { Quality: 2, CNC: 1, Forklift: 1 } },
  ],
  machines: [
    { id: 'm1', name: 'CNC Milling 01', code: 'CNC-01', requiredSkill: 'CNC', minLevel: 2, area: 'Machining', status: 'operating', nextMaintenance: '28 Nov 2026' },
    { id: 'm2', name: 'Arc Welder 03', code: 'WLD-03', requiredSkill: 'Welding', minLevel: 2, area: 'Fabrication', status: 'operating', nextMaintenance: '02 Dec 2026' },
    { id: 'm3', name: 'Assembly Line A', code: 'ASM-A', requiredSkill: 'Assembly', minLevel: 2, area: 'Assembly', status: 'idle', nextMaintenance: '30 Nov 2026' },
    { id: 'm4', name: 'Quality Station 02', code: 'QAL-02', requiredSkill: 'Quality', minLevel: 3, area: 'Quality', status: 'operating', nextMaintenance: '05 Dec 2026' },
  ],
  production: [
    { id: 'p1', product: 'Precision shaft', machineId: 'm1', target: 120, produced: 94 },
    { id: 'p2', product: 'Welded frame', machineId: 'm2', target: 80, produced: 67 },
    { id: 'p3', product: 'Assembly kit', machineId: 'm3', target: 60, produced: 38 },
    { id: 'p4', product: 'Inspected part', machineId: 'm4', target: 100, produced: 89 },
  ],
  allocations: {},
  alerts: [],
};

const relatedSkills = { CNC: ['Quality'], Welding: ['Assembly'], Assembly: ['Welding'], Quality: ['CNC'] };
const statusStyle = { operating: 'operating', idle: 'idle', fault: 'fault' };
function reason(worker, skill) { return `${worker.name.split(' ')[0]}: ${skill} level ${worker.skills[skill]}, present, ${worker.incidentCount} ${worker.incidentCount === 1 ? 'incident' : 'incidents'}`; }
function rankWorkers(workers) { return [...workers].sort((a, b) => b.level - a.level || a.incidentCount - b.incidentCount); }

export default function App() {
  const { data, setData } = useFactoryData();
  const [drafts, setDrafts] = useState({});
  const [suggested, setSuggested] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  const [page, setPage] = useState('Overview');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  function toggleDarkMode() {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  }

  function toggleSidebar() {
    setSidebarCollapsed((previous) => {
      const next = !previous;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }

  const shiftWorkers = useMemo(() => data.workers.filter((worker) => worker.shift === data.shift), [data]);
  const skills = useMemo(() => [...new Set(data.workers.flatMap((worker) => Object.keys(worker.skills)))].sort(), [data.workers]);
  const soleSkills = useMemo(() => new Set(skills.filter((skill) => data.workers.filter((worker) => worker.skills[skill] > 0).length === 1)), [skills, data.workers]);
  const allocationsForShift = data.allocations[data.shift] || {};
  const assignmentSource = { ...allocationsForShift, ...Object.fromEntries(Object.entries(drafts).map(([machineId, draft]) => [machineId, draft?.workerId])) };

  function getSuggestion(machine, excluded = new Set()) {
    const present = data.workers.filter((worker) => worker.shift === data.shift && worker.present && !excluded.has(worker.id));
    const eligible = rankWorkers(present.filter((worker) => (worker.skills[machine.requiredSkill] || 0) >= machine.minLevel)
      .map((worker) => ({ ...worker, level: worker.skills[machine.requiredSkill] })));
    const chosen = eligible[0];
    if (chosen) return { workerId: chosen.id, reason: reason(chosen, machine.requiredSkill), alternative: null };
    const suggestions = rankWorkers(present.flatMap((worker) => {
      const ownSkill = worker.skills[machine.requiredSkill] || 0;
      if (ownSkill > 0 && ownSkill < machine.minLevel) return [{ worker, level: ownSkill, skill: machine.requiredSkill }];
      return relatedSkills[machine.requiredSkill].flatMap((skill) => worker.skills[skill] ? [{ worker, level: worker.skills[skill], skill }] : []);
    }));
    return { workerId: null, reason: 'No worker meets this machine’s skill requirement.', alternative: suggestions[0] ? `${suggestions[0].worker.name} (${suggestions[0].skill} level ${suggestions[0].level})` : 'No present worker has a related skill.' };
  }

  function suggestAllocation() {
    const next = {};
    const used = new Set();
    const newAlerts = [];
    for (const machine of data.machines) {
      const option = getSuggestion(machine, used);
      next[machine.id] = option;
      if (option.workerId) used.add(option.workerId);
      else newAlerts.push({ id: `${machine.id}-${Date.now()}`, type: 'warning', message: `No eligible worker for ${machine.name}` });
    }
    setDrafts(next);
    setSuggested(true);
    setData((current) => ({ ...current, alerts: [...current.alerts.filter((alert) => !alert.message.startsWith('No eligible worker for ')), ...newAlerts] }));
  }

  function togglePresence(worker) {
    const becomingAbsent = worker.present;
    const assignments = data.allocations[worker.shift] || {};
    const machinesToReplace = becomingAbsent ? data.machines.filter((machine) => assignments[machine.id] === worker.id) : [];
    const replacementNotices = [];
    const changedAssignments = { ...assignments };
    const changedDrafts = { ...drafts };
    const alreadyUsed = new Set([...Object.values(assignments).filter((id) => id !== worker.id), worker.id]);
    for (const machine of machinesToReplace) {
      const replacement = getSuggestion(machine, alreadyUsed);
      changedAssignments[machine.id] = replacement.workerId || '';
      if (replacement.workerId) alreadyUsed.add(replacement.workerId);
      changedDrafts[machine.id] = replacement;
      replacementNotices.push(`${worker.name.split(' ')[0]} marked absent: suggested replacement ${replacement.workerId ? data.workers.find((item) => item.id === replacement.workerId)?.name.split(' ')[0] : 'none available'}`);
      if (!replacement.workerId) replacementNotices.push(`No eligible worker for ${machine.name}`);
    }
    setDrafts(changedDrafts);
    setData((current) => ({
      ...current,
      workers: current.workers.map((item) => item.id === worker.id ? { ...item, present: !item.present } : item),
      allocations: machinesToReplace.length ? { ...current.allocations, [worker.shift]: changedAssignments } : current.allocations,
      alerts: replacementNotices.length ? [...current.alerts, ...replacementNotices.map((message, index) => ({ id: `replacement-${Date.now()}-${index}`, type: message.startsWith('No eligible worker for ') ? 'warning' : 'info', message }))] : current.alerts,
    }));
    if (replacementNotices.length) setToast(replacementNotices[0]);
  }

  function confirmAllocation() {
    const assignedWorkerIds = Object.values(drafts).map((draft) => draft?.workerId).filter(Boolean);
    if (new Set(assignedWorkerIds).size !== assignedWorkerIds.length) {
      setToast('Each worker can only be assigned to one machine per shift.');
      return;
    }
    setData((current) => ({
      ...current,
      workers: current.workers.map((worker) => ({ ...worker, assignedMachineId: Object.keys(drafts).find((machineId) => drafts[machineId]?.workerId === worker.id) || null })),
      machines: current.machines.map((machine) => ({ ...machine, assignedWorkerId: drafts[machine.id]?.workerId || null })),
      allocations: { ...current.allocations, [data.shift]: Object.fromEntries(data.machines.map((machine) => [machine.id, drafts[machine.id]?.workerId || ''])) },
    }));
    setToast('Allocation confirmed and saved');
  }

  function pickOverride(machine, workerId) {
    const worker = data.workers.find((item) => item.id === workerId);
    const otherMachine = data.machines.find((item) => item.id !== machine.id && assignmentSource[item.id] === workerId);
    if (workerId && otherMachine) {
      setToast(`${worker.name.split(' ')[0]} is already assigned to ${otherMachine.name}. One worker can run one machine per shift.`);
      return;
    }
    const excluded = new Set(data.machines.filter((item) => item.id !== machine.id).map((item) => assignmentSource[item.id]).filter(Boolean));
    setDrafts((current) => ({ ...current, [machine.id]: workerId ? { workerId, reason: `Manager selected ${worker.name.split(' ')[0]} for this machine.`, alternative: null } : getSuggestion(machine, excluded) }));
  }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard }, { label: 'Shift Planner', icon: ClipboardList }, { label: 'Workers', icon: Users },
    { label: 'Machines', icon: Factory }, { label: 'Production', icon: Activity }, { label: 'Safety', icon: ShieldCheck }, { label: 'Maintenance', icon: Wrench },
  ];
  const productionUnits = data.production.reduce((sum, item) => sum + item.produced, 0);
  const productionTarget = data.production.reduce((sum, item) => sum + item.target, 0);
  const productionPercent = productionTarget ? Math.min(100, Math.round((productionUnits / productionTarget) * 100)) : 0;
  const presentWorkers = shiftWorkers.filter((worker) => worker.present).length;
  const operatingMachines = data.machines.filter((machine) => machine.status === 'operating').length;
  const safetyIncidents = data.workers.reduce((sum, worker) => sum + worker.incidentCount, 0);
  const shiftHours = data.shift === 'Morning' ? '6:00 AM – 2:00 PM' : '2:00 PM – 10:00 PM';

  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
      <div className="nav-label">WORKSPACE</div>
      <nav>{navItems.map(({ label, icon: Icon }) => <button type="button" key={label} aria-label={label} className={`nav-link ${page === label ? 'active' : ''}`} onClick={() => { setPage(label); setMobileMenu(false); }}><Icon size={18} /><span className="nav-link-label">{label}</span>{label === 'Safety' && <span className="nav-dot" />}</button>)}</nav>
    </aside>
      <button type="button" className="sidebar-collapse-button" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!sidebarCollapsed} title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}>{sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}</button>
    {mobileMenu && <button type="button" className="sidebar-backdrop" aria-label="Close menu" onClick={() => setMobileMenu(false)} />}
    <div className="main-column">
      <header className="topbar"><button className="menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Open menu"><Menu size={21} /></button><a className="topbar-brand" href="#overview" onClick={() => { setPage('Overview'); setMobileMenu(false); }}><img src="/favicon.svg" alt="" /><span>FactoryPulse<small>SHOP FLOOR CONTROL</small></span></a><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><b>{page}</b></div><div className="topbar-actions"><button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><i /></button><button className={`icon-button theme-toggle ${darkMode ? 'dark' : ''}`} onClick={toggleDarkMode} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>{darkMode ? <Sun size={19} /> : <Moon size={19} />}</button><div className={`profile-menu ${profileMenuOpen ? 'is-open' : ''}`} onMouseEnter={() => setProfileMenuOpen(true)} onMouseLeave={() => setProfileMenuOpen(false)} onKeyDown={(event) => { if (event.key === 'Escape') setProfileMenuOpen(false); }}><button type="button" className="profile-pill" aria-haspopup="menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)}><div className="avatar avatar-green">AS</div><span className="profile-pill-copy"><b>Admin Supervisor</b><small>Plant manager</small></span><ChevronDown size={15} /></button><div className="profile-dropdown" role="menu"><div className="profile-dropdown-heading"><div className="avatar avatar-green">AS</div><span><b>Admin Supervisor</b><small>Plant manager · Rajkot Works</small></span></div><button type="button" role="menuitem" className={page === 'Account' ? 'selected' : ''} onClick={() => { setPage('Account'); setProfileMenuOpen(false); }}><UserRound size={16} />My account</button><button type="button" role="menuitem" className={page === 'Settings' ? 'selected' : ''} onClick={() => { setPage('Settings'); setProfileMenuOpen(false); }}><Settings size={16} />Settings</button></div></div></div></header>
      <main className="content"><div className="page-heading"><div><div className="eyebrow"><span className="live-dot" /> LIVE OPERATIONS <span className="eyebrow-divider">·</span> RAJKOT WORKS</div><h1>{page}</h1><p>{page === 'Shift Planner' ? 'Plan your crew. Keep every machine moving.' : page === 'Overview' ? 'Production, people, and equipment at a glance.' : `Rajkot Works · ${page}`}</p></div><div className="heading-date-area"><div className="date-info-card"><span className="date-card-icon"><CalendarDays size={17} /></span><span className="date-info-copy"><small>SHIFT DATE</small><b>Tuesday, 25 November 2026</b></span></div><div className="shift-info-card"><span className="shift-info-indicator"><i className="live-dot" /></span><span className="shift-info-copy"><b>{data.shift} shift</b><small>In progress</small></span><span className="shift-hours">{shiftHours}</span></div></div></div>

        {toast && <div className="toast"><Check size={17} />{toast}<button onClick={() => setToast('')}>Dismiss</button></div>}
        {data.alerts.filter((alert) => alert.type === 'info').slice(-1).map((alert) => <div className="replacement-banner" key={alert.id}><span className="banner-icon"><ArrowDownRight size={18} /></span><span>{alert.message}</span><button onClick={() => setData((current) => ({ ...current, alerts: current.alerts.filter((item) => item.id !== alert.id) }))} aria-label="Dismiss banner">×</button></div>)}
        {data.alerts.filter((alert) => alert.type === 'warning').slice(-3).map((alert) => <div className="warning-banner" key={alert.id}><AlertTriangle size={16} /><span>{alert.message}</span><button onClick={() => setData((current) => ({ ...current, alerts: current.alerts.filter((item) => item.id !== alert.id) }))} aria-label="Dismiss warning">×</button></div>)}

        {['Shift Planner', 'Workers'].includes(page) && <section className="shift-section"><div className="section-title"><div><h2>Choose a shift</h2><span>Select the crew you’re planning for</span></div><div className="shift-toggle"><button className={data.shift === 'Morning' ? 'selected' : ''} onClick={() => { setData((current) => ({ ...current, shift: 'Morning' })); setDrafts({}); setSuggested(false); }}>☀ <span>Morning</span><small>6:00 AM – 2:00 PM</small></button><button className={data.shift === 'Afternoon' ? 'selected' : ''} onClick={() => { setData((current) => ({ ...current, shift: 'Afternoon' })); setDrafts({}); setSuggested(false); }}>◐ <span>Afternoon</span><small>2:00 PM – 10:00 PM</small></button></div></div>
        <div className="crew-card"><div className="card-heading"><div><h3><Users size={17} /> {data.shift} shift crew</h3><p>Mark who’s on the floor today</p></div><span className="crew-count">{shiftWorkers.filter((worker) => worker.present).length} <span>of</span> {shiftWorkers.length} present</span></div><div className="worker-list">{shiftWorkers.map((worker) => <div className={`worker-row ${!worker.present ? 'worker-absent' : ''}`} key={worker.id}><div className={`avatar worker-avatar ${['avatar-purple', 'avatar-green', 'avatar-orange', 'avatar-blue'][Number(worker.id.slice(1)) % 4]}`}>{worker.short}</div><div className="worker-info"><b>{worker.name}</b><span>{Object.keys(worker.skills).join(' · ')} <i>·</i> {worker.incidentCount} incidents</span></div><button role="switch" aria-checked={worker.present} aria-label={`${worker.name} ${worker.present ? 'present' : 'absent'}`} className={`presence-toggle ${worker.present ? 'is-present' : ''}`} onClick={() => togglePresence(worker)}><span />{worker.present ? 'Present' : 'Absent'}</button></div>)}</div></div></section>}

        {['Shift Planner', 'Machines'].includes(page) && <section className="allocation-section"><div className="section-title allocation-heading"><div><h2>Machine allocation</h2><span>Match the right skills to each machine</span></div><button className="suggest-button" onClick={suggestAllocation}><Sparkles size={17} /> Suggest allocation</button></div>
          <div className="machine-list">{data.machines.map((machine) => {
            const draft = drafts[machine.id];
            const savedWorkerId = allocationsForShift[machine.id];
            const assignedWorkerId = suggested && draft ? draft.workerId : (draft?.workerId || savedWorkerId);
            const assignedWorker = data.workers.find((worker) => worker.id === assignedWorkerId);
            const isSuggested = suggested && Boolean(draft);
            const assignedElsewhere = new Map(data.machines.filter((item) => item.id !== machine.id && assignmentSource[item.id]).map((item) => [assignmentSource[item.id], item.name]));
            return <article className={`machine-card ${!assignedWorker && isSuggested ? 'machine-unstaffed' : ''}`} key={machine.id}><div className="machine-card-main"><div className={`machine-icon ${statusStyle[machine.status]}`}><Gauge size={20} /></div><div className="machine-details"><div className="machine-name-line"><h3>{machine.name}</h3><span className={`machine-status ${statusStyle[machine.status]}`}><i />{machine.status}</span></div><div className="machine-meta"><span>{machine.code}</span><i>·</i><span>{machine.area}</span><i>·</i><span>Needs {machine.requiredSkill} L{machine.minLevel}+</span></div></div>{isSuggested && !assignedWorker && <span className="unstaffed-badge"><AlertTriangle size={13} /> Unstaffed</span>}</div>
              <div className="assignment-row"><div className="assigned-person"><div className={`avatar small-avatar ${assignedWorker ? 'avatar-purple' : 'empty-avatar'}`}>{assignedWorker?.short || <Users size={14} />}</div><div><span className="assignment-label">{isSuggested ? assignedWorker ? 'SUGGESTED OPERATOR' : 'NO ELIGIBLE OPERATOR' : assignedWorker ? 'CURRENT OPERATOR' : 'NOT ASSIGNED'}</span><b className={assignedWorker ? '' : 'muted-name'}>{assignedWorker?.name || 'Awaiting assignment'}</b></div></div><label className="override-select"><span>Override</span><select aria-label={`Override ${machine.name} worker`} value={draft ? draft.workerId || '' : savedWorkerId || ''} onChange={(event) => pickOverride(machine, event.target.value)}><option value="">{isSuggested ? 'Choose worker' : 'Select worker'}</option>{data.workers.filter((worker) => worker.shift === data.shift && worker.present).map((worker) => <option key={worker.id} value={worker.id}>{worker.name}{assignedElsewhere.has(worker.id) ? ` — already on ${assignedElsewhere.get(worker.id)}` : ''}</option>)}</select><ChevronDown size={14} /></label></div>
              {isSuggested && <div className={`reason-line ${assignedWorker ? '' : 'reason-warning'}`}>{assignedWorker ? <><span className="reason-check"><Check size={12} /></span>{draft.reason}</> : <><AlertTriangle size={14} />{draft.reason} <span className="alternative">Closest: {draft.alternative}</span></>}</div>}
            </article>;
          })}</div>
          <div className="allocation-footer"><span><CircleHelp size={15} /> Suggestions use skill level, then incident count.</span><button className="confirm-button" disabled={!suggested} onClick={confirmAllocation}><Check size={17} /> Confirm allocation</button></div>
        </section>}

        {['Shift Planner', 'Workers'].includes(page) && <section className="skills-section"><div className="section-title"><div><h2>Skills matrix</h2><span>Team coverage by certified skill</span></div><div className="matrix-legend"><span><i className="legend-skill" /> Skilled</span><span><i className="legend-single" /> Single point of failure</span></div></div><div className="matrix-wrap"><table><thead><tr><th className="worker-col">WORKER</th>{skills.map((skill) => <th key={skill}>{skill.toUpperCase()}{soleSkills.has(skill) && <span className="sole-skill-dot" title="Single point of failure">!</span>}</th>)}</tr></thead><tbody>{data.workers.map((worker) => <tr key={worker.id}><td className="matrix-worker"><div className={`avatar matrix-avatar ${['avatar-purple', 'avatar-green', 'avatar-orange', 'avatar-blue'][Number(worker.id.slice(1)) % 4]}`}>{worker.short}</div><span><b>{worker.name}</b><small>{worker.shift}</small></span></td>{skills.map((skill) => <td key={skill}>{worker.skills[skill] ? <span className={`skill-pill ${soleSkills.has(skill) ? 'skill-single' : ''}`}>L{worker.skills[skill]}</span> : <span className="no-skill">—</span>}</td>)}</tr>)}</tbody></table></div><p className="matrix-note"><AlertTriangle size={14} /> Skills marked <b>!</b> are held by one worker across the team.</p></section>}

        {page === 'Overview' && <section className="overview-dashboard">
          <div className="overview-stat-grid">
            <article className="overview-stat overview-stat-production"><span className="module-kicker">PRODUCTION TODAY</span><div className="overview-stat-value">{productionUnits}<small>units</small></div><div className="overview-stat-foot"><span>of {productionTarget} target</span><b>{productionPercent}%</b></div><div className="overview-progress"><i style={{ width: `${productionPercent}%` }} /></div></article>
            <article className="overview-stat"><span className="module-kicker">SHIFT CREW</span><div className="overview-stat-value">{presentWorkers}<small>/ {shiftWorkers.length} present</small></div><div className="overview-stat-foot"><span>{data.shift} shift</span><b className="stat-status"><i /> On floor</b></div></article>
            <article className="overview-stat"><span className="module-kicker">MACHINE HEALTH</span><div className="overview-stat-value">{operatingMachines}<small>/ {data.machines.length} running</small></div><div className="overview-stat-foot"><span>{data.machines.filter((machine) => machine.status === 'fault').length} faults reported</span><b className="stat-status"><i /> Live</b></div></article>
            <article className="overview-stat"><span className="module-kicker">SAFETY INCIDENTS</span><div className="overview-stat-value">{safetyIncidents}<small>team total</small></div><div className="overview-stat-foot"><span>Across all shifts</span><b className="stat-neutral">Tracked</b></div></article>
          </div>
          <div className="overview-panel-grid">
            <section className="overview-panel production-overview"><div className="overview-panel-heading"><div><span className="panel-icon"><Activity size={17} /></span><div><h2>Production progress</h2><p>Output against today’s target</p></div></div><span className="overview-total">{productionPercent}%</span></div><div className="overview-production-list">{data.production.map((order) => { const machine = data.machines.find((item) => item.id === order.machineId); const percent = Math.min(100, Math.round((order.produced / order.target) * 100)); return <div className="overview-production-row" key={order.id}><div className="overview-production-label"><span><b>{order.product}</b><small>{machine?.name || 'Production line'}</small></span><strong>{order.produced}<small> / {order.target}</small></strong></div><div className="overview-progress"><i style={{ width: `${percent}%` }} /></div></div>; })}</div></section>
            <section className="overview-panel machine-overview"><div className="overview-panel-heading"><div><span className="panel-icon"><Factory size={17} /></span><div><h2>Machine status</h2><p>Current floor conditions</p></div></div><span className="live-badge"><i /> LIVE</span></div><div className="overview-machine-list">{data.machines.map((machine) => <div className="overview-machine-row" key={machine.id}><span className={`overview-machine-icon ${machine.status}`}><Gauge size={16} /></span><span className="overview-machine-copy"><b>{machine.name}</b><small>{machine.code} · {machine.area}</small></span><span className={`overview-machine-status ${machine.status}`}><i />{machine.status}</span></div>)}</div></section>
          </div>
          <button type="button" className="overview-shift-card" onClick={() => setPage('Shift Planner')}><span className="overview-shift-icon"><ClipboardList size={19} /></span><span className="overview-shift-copy"><b>{data.shift} shift planning</b><small>{presentWorkers} of {shiftWorkers.length} operators present · {data.machines.length} machines to staff</small></span><span className="overview-shift-link">Open planner <ArrowDownRight size={15} /></span></button>
        </section>}

        {page === 'Production' && <section className="module-panel"><div className="section-title"><div><h2>Production today</h2><span>Simulated output against each line’s target</span></div></div>{data.production.map((order) => { const machine = data.machines.find((item) => item.id === order.machineId); const percent = Math.min(100, Math.round((order.produced / order.target) * 100)); return <div className="production-row" key={order.id}><div className="production-label"><span><b>{order.product}</b><small>{machine?.name || 'Production line'}</small></span><strong>{order.produced} / {order.target}</strong></div><div className="progress-track"><span style={{ width: `${percent}%` }} /></div></div>; })}</section>}

        {page === 'Safety' && <section className="module-grid"><article className="module-card"><span className="module-kicker">TEAM INCIDENTS</span><strong>{data.workers.reduce((sum, worker) => sum + worker.incidentCount, 0)}</strong><p>simulated records across all workers</p></article><article className="module-card"><span className="module-kicker">ACTIVE WARNINGS</span><strong>{data.alerts.filter((alert) => alert.type === 'warning').length}</strong><p>shift planner warnings</p></article><div className="module-panel"><h2>Worker safety records</h2>{data.workers.map((worker) => <div className="module-row" key={worker.id}><span>{worker.name}<small>{worker.shift} shift</small></span><b className={worker.incidentCount ? 'status-text idle' : 'status-text operating'}>{worker.incidentCount} incidents</b></div>)}</div></section>}

        {page === 'Maintenance' && <section className="module-panel"><div className="section-title"><div><h2>Machine maintenance</h2><span>Simulated next service dates</span></div></div>{data.machines.map((machine) => <div className="module-row" key={machine.id}><span><b>{machine.name}</b><small>{machine.code} · {machine.area}</small></span><span><small>Next service</small><b>{machine.nextMaintenance || 'Date not set'}</b></span><b className={`status-text ${machine.status}`}>{machine.status}</b></div>)}</section>}

        {page === 'Settings' && <section className="module-panel settings-panel"><h2>Settings</h2><div className="module-row"><span><b>Appearance</b><small>Choose light or dark display mode</small></span><button type="button" className="confirm-button" onClick={toggleDarkMode}>{darkMode ? 'Switch to light mode' : 'Switch to dark mode'}</button></div><p>FactoryPulse uses simulated demo data stored on this device.</p></section>}

        {page === 'Account' && <section className="module-panel account-panel"><h2>My account</h2><div className="account-identity"><div className="avatar avatar-green">AS</div><span><b>Admin Supervisor</b><small>Plant manager</small></span></div><div className="module-row"><span><b>Workspace</b><small>Rajkot Works · Gujarat, India</small></span></div></section>}

        <footer className="page-footer"><span>FactoryPulse <i>·</i> Shop floor overview</span><span>All data is simulated for demo purposes</span></footer>
      </main>
      <nav className="mobile-tabs">{[{ label: 'Home', page: 'Overview', icon: LayoutDashboard }, { label: 'Planner', page: 'Shift Planner', icon: ClipboardList }, { label: 'Workers', page: 'Workers', icon: Users }, { label: 'Machines', page: 'Machines', icon: Factory }, { label: 'More', page: null, icon: Menu }].map(({ label, page: targetPage, icon: Icon }) => <button type="button" key={label} className={targetPage === page ? 'tab-active' : ''} onClick={() => targetPage ? setPage(targetPage) : setMobileMenu(true)}><Icon size={20} /><span>{label}</span></button>)}</nav>
    </div>
  </div>;
}
