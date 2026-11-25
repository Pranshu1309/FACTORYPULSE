import { useMemo, useState, useEffect } from 'react';
import { Activity, AlertTriangle, ArrowDownRight, Bell, Check, ChevronDown, CircleHelp, ClipboardList, Factory, Gauge, LayoutDashboard, Menu, Settings, ShieldCheck, Sparkles, Users, Wrench, Moon, Sun } from 'lucide-react';
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
    { id: 'm1', name: 'CNC Milling 01', code: 'CNC-01', requiredSkill: 'CNC', minLevel: 2, area: 'Machining', status: 'operating' },
    { id: 'm2', name: 'Arc Welder 03', code: 'WLD-03', requiredSkill: 'Welding', minLevel: 2, area: 'Fabrication', status: 'operating' },
    { id: 'm3', name: 'Assembly Line A', code: 'ASM-A', requiredSkill: 'Assembly', minLevel: 2, area: 'Assembly', status: 'idle' },
    { id: 'm4', name: 'Quality Station 02', code: 'QAL-02', requiredSkill: 'Quality', minLevel: 3, area: 'Quality', status: 'operating' },
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
  const [page, setPage] = useState('Shift Planner');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  function toggleDarkMode() {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  }

  const shiftWorkers = useMemo(() => data.workers.filter((worker) => worker.shift === data.shift), [data]);
  const skills = useMemo(() => [...new Set(data.workers.flatMap((worker) => Object.keys(worker.skills)))].sort(), [data.workers]);
  const soleSkills = useMemo(() => new Set(skills.filter((skill) => data.workers.filter((worker) => worker.skills[skill] > 0).length === 1)), [skills, data.workers]);
  const allocationsForShift = data.allocations[data.shift] || {};

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
    setDrafts((current) => ({ ...current, [machine.id]: workerId ? { workerId, reason: `Manager selected ${worker.name.split(' ')[0]} for this machine.`, alternative: null } : getSuggestion(machine) }));
  }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard }, { label: 'Workers', icon: Users }, { label: 'Machines', icon: Factory },
    { label: 'Production', icon: Activity }, { label: 'Safety', icon: ShieldCheck }, { label: 'Maintenance', icon: Wrench }, { label: 'Shift Planner', icon: ClipboardList },
  ];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
      <a className="brand" href="#planner" onClick={() => setPage('Shift Planner')}><span className="brand-mark"><Factory size={20} /></span><span>Factory<span className="brand-light">Pulse</span><small>SHOP FLOOR CONTROL</small></span></a>
      <div className="plant-select"><span className="plant-icon"><Factory size={18} /></span><span><b>Rajkot Works</b><small>Gujarat, India</small></span><ChevronDown size={15} /></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-link ${page === label ? 'active' : ''}`} onClick={() => { setPage(label); setMobileMenu(false); }}><Icon size={18} /><span>{label}</span>{label === 'Safety' && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="shift-chip"><span className="live-dot" /><span>Morning shift in progress</span></div><button className="nav-link"><Settings size={18} /><span>Settings</span></button><div className="user-profile"><div className="avatar avatar-purple">AS</div><span><b>Admin Supervisor</b><small>Plant manager</small></span><ChevronDown size={15} /></div></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><button className="menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Open menu"><Menu size={21} /></button><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><b>{page}</b></div><div className="topbar-actions"><span className="date-label">Tue, 25 Nov 2026</span><button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><i /></button><button className={`icon-button theme-toggle ${darkMode ? 'dark' : ''}`} onClick={toggleDarkMode} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>{darkMode ? <Sun size={19} /> : <Moon size={19} />}</button><div className="avatar avatar-green">AS</div></div></header>
      <main className="content"><div className="page-heading"><div><div className="eyebrow"><span className="live-dot" /> LIVE OPERATIONS <span className="eyebrow-divider">·</span> RAJKOT WORKS</div><h1>Shift Planner</h1><p>Plan your crew. Keep every machine moving.</p></div><div className="heading-date"><span>SHIFT DATE</span><b>Tuesday, 25 November 2026</b></div></div>

        {toast && <div className="toast"><Check size={17} />{toast}<button onClick={() => setToast('')}>Dismiss</button></div>}
        {data.alerts.filter((alert) => alert.type === 'info').slice(-1).map((alert) => <div className="replacement-banner" key={alert.id}><span className="banner-icon"><ArrowDownRight size={18} /></span><span>{alert.message}</span><button onClick={() => setData((current) => ({ ...current, alerts: current.alerts.filter((item) => item.id !== alert.id) }))} aria-label="Dismiss banner">×</button></div>)}
        {data.alerts.filter((alert) => alert.type === 'warning').slice(-3).map((alert) => <div className="warning-banner" key={alert.id}><AlertTriangle size={16} /><span>{alert.message}</span><button onClick={() => setData((current) => ({ ...current, alerts: current.alerts.filter((item) => item.id !== alert.id) }))} aria-label="Dismiss warning">×</button></div>)}

        <section className="shift-section"><div className="section-title"><div><h2>Choose a shift</h2><span>Select the crew you’re planning for</span></div><div className="shift-toggle"><button className={data.shift === 'Morning' ? 'selected' : ''} onClick={() => { setData((current) => ({ ...current, shift: 'Morning' })); setDrafts({}); setSuggested(false); }}>☀ <span>Morning</span><small>6:00 AM – 2:00 PM</small></button><button className={data.shift === 'Afternoon' ? 'selected' : ''} onClick={() => { setData((current) => ({ ...current, shift: 'Afternoon' })); setDrafts({}); setSuggested(false); }}>◐ <span>Afternoon</span><small>2:00 PM – 10:00 PM</small></button></div></div>
        <div className="crew-card"><div className="card-heading"><div><h3><Users size={17} /> {data.shift} shift crew</h3><p>Mark who’s on the floor today</p></div><span className="crew-count">{shiftWorkers.filter((worker) => worker.present).length} <span>of</span> {shiftWorkers.length} present</span></div><div className="worker-list">{shiftWorkers.map((worker) => <div className={`worker-row ${!worker.present ? 'worker-absent' : ''}`} key={worker.id}><div className={`avatar worker-avatar ${['avatar-purple', 'avatar-green', 'avatar-orange', 'avatar-blue'][Number(worker.id.slice(1)) % 4]}`}>{worker.short}</div><div className="worker-info"><b>{worker.name}</b><span>{Object.keys(worker.skills).join(' · ')} <i>·</i> {worker.incidentCount} incidents</span></div><button role="switch" aria-checked={worker.present} aria-label={`${worker.name} ${worker.present ? 'present' : 'absent'}`} className={`presence-toggle ${worker.present ? 'is-present' : ''}`} onClick={() => togglePresence(worker)}><span />{worker.present ? 'Present' : 'Absent'}</button></div>)}</div></div></section>

        <section className="allocation-section"><div className="section-title allocation-heading"><div><h2>Machine allocation</h2><span>Match the right skills to each machine</span></div><button className="suggest-button" onClick={suggestAllocation}><Sparkles size={17} /> Suggest allocation</button></div>
          <div className="machine-list">{data.machines.map((machine) => {
            const draft = drafts[machine.id];
            const savedWorkerId = allocationsForShift[machine.id];
            const assignedWorker = data.workers.find((worker) => worker.id === (draft?.workerId || savedWorkerId));
            const isSuggested = suggested && Boolean(draft);
            return <article className={`machine-card ${!assignedWorker && isSuggested ? 'machine-unstaffed' : ''}`} key={machine.id}><div className="machine-card-main"><div className={`machine-icon ${statusStyle[machine.status]}`}><Gauge size={20} /></div><div className="machine-details"><div className="machine-name-line"><h3>{machine.name}</h3><span className={`machine-status ${statusStyle[machine.status]}`}><i />{machine.status}</span></div><div className="machine-meta"><span>{machine.code}</span><i>·</i><span>{machine.area}</span><i>·</i><span>Needs {machine.requiredSkill} L{machine.minLevel}+</span></div></div>{isSuggested && !assignedWorker && <span className="unstaffed-badge"><AlertTriangle size={13} /> Unstaffed</span>}</div>
              <div className="assignment-row"><div className="assigned-person"><div className={`avatar small-avatar ${assignedWorker ? 'avatar-purple' : 'empty-avatar'}`}>{assignedWorker?.short || <Users size={14} />}</div><div><span className="assignment-label">{isSuggested ? assignedWorker ? 'SUGGESTED OPERATOR' : 'NO ELIGIBLE OPERATOR' : assignedWorker ? 'CURRENT OPERATOR' : 'NOT ASSIGNED'}</span><b className={assignedWorker ? '' : 'muted-name'}>{assignedWorker?.name || 'Awaiting assignment'}</b></div></div><label className="override-select"><span>Override</span><select aria-label={`Override ${machine.name} worker`} value={draft?.workerId || ''} onChange={(event) => pickOverride(machine, event.target.value)}><option value="">{isSuggested ? 'Choose worker' : 'Select worker'}</option>{data.workers.filter((worker) => worker.shift === data.shift && worker.present).map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select><ChevronDown size={14} /></label></div>
              {isSuggested && <div className={`reason-line ${assignedWorker ? '' : 'reason-warning'}`}>{assignedWorker ? <><span className="reason-check"><Check size={12} /></span>{draft.reason}</> : <><AlertTriangle size={14} />{draft.reason} <span className="alternative">Closest: {draft.alternative}</span></>}</div>}
            </article>;
          })}</div>
          <div className="allocation-footer"><span><CircleHelp size={15} /> Suggestions use skill level, then incident count.</span><button className="confirm-button" disabled={!suggested} onClick={confirmAllocation}><Check size={17} /> Confirm allocation</button></div>
        </section>

        <section className="skills-section"><div className="section-title"><div><h2>Skills matrix</h2><span>Team coverage by certified skill</span></div><div className="matrix-legend"><span><i className="legend-skill" /> Skilled</span><span><i className="legend-single" /> Single point of failure</span></div></div><div className="matrix-wrap"><table><thead><tr><th className="worker-col">WORKER</th>{skills.map((skill) => <th key={skill}>{skill.toUpperCase()}{soleSkills.has(skill) && <span className="sole-skill-dot" title="Single point of failure">!</span>}</th>)}</tr></thead><tbody>{data.workers.map((worker) => <tr key={worker.id}><td className="matrix-worker"><div className={`avatar matrix-avatar ${['avatar-purple', 'avatar-green', 'avatar-orange', 'avatar-blue'][Number(worker.id.slice(1)) % 4]}`}>{worker.short}</div><span><b>{worker.name}</b><small>{worker.shift}</small></span></td>{skills.map((skill) => <td key={skill}>{worker.skills[skill] ? <span className={`skill-pill ${soleSkills.has(skill) ? 'skill-single' : ''}`}>L{worker.skills[skill]}</span> : <span className="no-skill">—</span>}</td>)}</tr>)}</tbody></table></div><p className="matrix-note"><AlertTriangle size={14} /> Skills marked <b>!</b> are held by one worker across the team.</p></section>

        <footer className="page-footer"><span>FactoryPulse <i>·</i> Shop floor overview</span><span>All data is simulated for demo purposes</span></footer>
      </main>
      <nav className="mobile-tabs">{[{ label: 'Home', icon: LayoutDashboard }, { label: 'Workers', icon: Users }, { label: 'Machines', icon: Factory }, { label: 'Planner', icon: ClipboardList }, { label: 'More', icon: Menu }].map(({ label, icon: Icon }) => <button key={label} className={label === 'Planner' ? 'tab-active' : ''} onClick={() => setPage(label === 'Planner' ? 'Shift Planner' : label)}><Icon size={20} /><span>{label}</span></button>)}</nav>
    </div>
  </div>;
}
