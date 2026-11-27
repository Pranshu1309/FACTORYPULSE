import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowDownRight, Bell, Check, ChevronDown, CircleHelp, ClipboardList, Factory, Gauge, LayoutDashboard, Menu, Moon, Pause, Play, RotateCcw, Settings, ShieldCheck, Sparkles, Sun, Users, Wrench, X, Thermometer, Siren, Clock3 } from 'lucide-react';
import { useFactoryData } from './context/FactoryContext.jsx';
import { advanceSimulation, createSeedData, formatClock } from './simulation.js';
import { translations } from './translations.js';

export const initialData = createSeedData();

const navItems = [
  { id:'Dashboard', key:'navOverview', icon:LayoutDashboard },
  { id:'Workers', key:'navWorkers', icon:Users },
  { id:'Machines', key:'navMachines', icon:Factory },
  { id:'Production', key:'navProduction', icon:Activity },
  { id:'Safety', key:'navSafety', icon:ShieldCheck },
  { id:'Maintenance', key:'navMaintenance', icon:Wrench },
  { id:'Alerts', key:'navAlerts', icon:Bell },
  { id:'Shift Summary', key:'navSummary', icon:ClipboardList },
  { id:'Shift Planner', key:'navPlanner', icon:Clock3 },
];
const reportTypes = ['Hazard','Near-miss','Injury'];
const downtimeReasons = ['Breakdown','No operator','Material shortage','Changeover'];
const fixCauses = ['Electrical','Mechanical','Hydraulic','Wear','Other'];
const reportTypeKeys = { Hazard:'hazard','Near-miss':'nearMiss',Injury:'injury' };
const relatedSkills = { CNC:['Quality'],Welding:['Assembly'],Assembly:['Welding'],Quality:['CNC'] };
const statusKeys = { operating:'operating',idle:'idle',fault:'fault',maintenanceScheduled:'scheduled' };
const alertKeys = { productionBelow:'productionBelow',excessiveDowntime:'excessiveDowntime',workerShortage:'workerShortage',upcomingMaintenance:'upcomingMaintenance',overdueMaintenance:'overdue',safetyIncident:'safetyIncident',machineFault:'machineFault',runningHot:'runningHot' };
const initials = (name='') => name.split(' ').map((part)=>part[0]).slice(0,2).join('').toUpperCase();
const localDateTime = (date=new Date()) => new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
const recentFaultCount = (machine) => machine.faultHistory.filter((fault)=>Date.now()-new Date(fault.timestamp).getTime()<=30*86400000).length;
const isChronic = (machine) => recentFaultCount(machine)>=3;
const totalOf = (items,key) => items.reduce((sum,item)=>sum+(Number(item[key])||0),0);
function uniqueAlert(alerts,code,severity,message,extra={}) {
  const dedupeKey=extra.dedupeKey||`${code}:${extra.machineId||'shift'}`;
  if(alerts.some((item)=>item.dedupeKey===dedupeKey))return alerts;
  return [{id:`a-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,code,severity,message,createdAt:new Date().toISOString(),read:false,dedupeKey,...extra},...alerts];
}
function tAlert(alert,t) {
  if(alert.severity==='info')return alert.message;
  if(alert.code==='productionBelow'||alert.code==='workerShortage')return t(alert.code==='productionBelow'?'productionBelow':'workerShortage');
  const base=t(alertKeys[alert.code]||'safetyIncident');
  if(alert.code==='safetyIncident')return `${base}: ${t(alert.incidentType||'hazard')} · ${alert.location||''}`;
  if(alert.code==='runningHot'||alert.code==='machineFault'||alert.code==='upcomingMaintenance'||alert.code==='overdueMaintenance')return `${alert.machineName||''} ${base}`.trim();
  if(alert.code==='excessiveDowntime')return `${base}: ${alert.machineName||''}`;
  return alert.message;
}

export default function App() {
  const {data,setData}=useFactoryData();
  const [page,setPage]=useState('Dashboard');
  const [mobileMenu,setMobileMenu]=useState(false);
  const [drafts,setDrafts]=useState({});
  const [suggested,setSuggested]=useState(false);
  const [toast,setToast]=useState('');
  const [modal,setModal]=useState(null);
  const [reportForm,setReportForm]=useState({type:'',location:'',note:''});
  const [incidentFilter,setIncidentFilter]=useState('All');
  const [demoOpen,setDemoOpen]=useState(false);
  const [summaryOpened,setSummaryOpened]=useState(false);
  const [darkMode,setDarkMode]=useState(()=>localStorage.getItem('theme')==='dark');
  const lang=data.language||'en';
  const t=(key)=>translations[lang]?.[key]||translations.en[key]||key;
  const shiftWorkers=useMemo(()=>data.workers.filter((worker)=>worker.shift===data.shift),[data.workers,data.shift]);
  const allocations=data.allocations?.[data.shift]||{};
  const skills=useMemo(()=>[...new Set(data.workers.flatMap((worker)=>Object.keys(worker.skills)))].sort(),[data.workers]);
  const soleSkills=useMemo(()=>new Set(skills.filter((skill)=>data.workers.filter((worker)=>worker.skills[skill]>0).length===1)),[skills,data.workers]);
  const unreadCount=data.alerts.filter((alert)=>!alert.read).length;
  const elapsed=data.simulation.elapsedMinutes;
  const shiftLength=data.simulation.shiftLengthMinutes||480;
  const totalTarget=totalOf(data.production,'target');
  const totalUnits=totalOf(data.production,'unitsMade');
  const expectedUnits=totalTarget*(elapsed/shiftLength);
  const outputPercent=totalTarget?Math.min(100,Math.round(totalUnits/totalTarget*100)):0;
  const paceGap=expectedUnits?Math.max(0,Math.round((expectedUnits-totalUnits)/expectedUnits*100)):0;
  const openIncidents=data.incidents.filter((incident)=>incident.status==='open');
  const currentShiftStart=data.simulation.shiftStartedAt||0;
  const thisShiftIncidents=data.incidents.filter((incident)=>incident.shift===data.shift&&new Date(incident.createdAt).getTime()>=currentShiftStart);
  const operatingMachines=data.machines.filter((machine)=>machine.status==='operating');
  const maintenanceMachines=data.machines.filter((machine)=>machine.maintenanceState==='dueSoon'||machine.maintenanceState==='overdue'||isChronic(machine)||machine.status==='fault');

  useEffect(()=>{
    document.documentElement.classList.toggle('dark',darkMode);
    localStorage.setItem('theme',darkMode?'dark':'light');
  },[darkMode]);

  useEffect(()=>{
    if(!data.simulation.running)return undefined;
    const timer=window.setInterval(()=>setData((current)=>advanceSimulation(current)),2000);
    return()=>window.clearInterval(timer);
  },[data.simulation.running,data.simulation.speed,setData]);

  useEffect(()=>{
    if(data.simulation.completed&&!summaryOpened){setPage('Shift Summary');setSummaryOpened(true);}
  },[data.simulation.completed,summaryOpened]);

  function navigate(nextPage) {
    setPage(nextPage);setMobileMenu(false);window.scrollTo({top:0,behavior:'smooth'});
  }

  function toggleTheme(){setDarkMode((value)=>!value);}

  function startProduction(){
    setData((current)=>{
      const assignment=current.allocations?.[current.shift]||{};
      const machines=current.machines.map((machine)=>{
        if(machine.status==='fault'||machine.status==='maintenanceScheduled')return machine;
        const id=assignment[machine.id]||machine.assignedWorkerId;
        const operator=current.workers.find((worker)=>worker.id===id&&worker.shift===current.shift&&worker.present);
        return {...machine,assignedWorkerId:operator?.id||null,status:operator?'operating':'idle',downtimeReason:operator?machine.downtimeReason:'No operator'};
      });
      const workers=current.workers.map((worker)=>worker.shift===current.shift?{...worker,assignedMachineId:machines.find((machine)=>machine.assignedWorkerId===worker.id)?.id||null}:worker);
      let alerts=[...current.alerts];
      if(machines.some((machine)=>machine.status==='idle'&&!machine.assignedWorkerId))alerts=uniqueAlert(alerts,'workerShortage','warning','Worker shortage: one or more machines are unstaffed');
      return {...current,machines,workers,simulation:{...current.simulation,running:true,completed:false}};
    });
    setSummaryOpened(false);
  }

  function pauseProduction(){setData((current)=>({...current,simulation:{...current.simulation,running:false}}));}

  function resetShift(){
    const seed=createSeedData();
    setData((current)=>{
      const seededAssignments=seed.allocations?.[current.shift]||{};
      const workers=current.workers.map((worker)=>({...worker,runningMinutes:0,assignedMachineId:Object.keys(seededAssignments).find((machineId)=>seededAssignments[machineId]===worker.id)||null}));
      const machines=current.machines.map((machine)=>{
        const assigned=seededAssignments[machine.id]||null;
        return {...machine,assignedWorkerId:assigned,status:'idle',unitsMade:0,downtimeMinutes:0,downtimeStartedAt:null,downtimeReason:'No operator',longDowntimeAlertSent:false};
      });
      return {...current,workers,machines,production:seed.production,simulation:{...seed.simulation,speed:current.simulation.speed,shiftStartedAt:Date.now()},alerts:current.alerts.filter((alert)=>alert.code==='safetyIncident'),incidents:current.incidents};
    });
    setDrafts({});setSuggested(false);setSummaryOpened(false);setPage('Dashboard');
  }

  function changeShift(nextShift){
    if(nextShift===data.shift)return;
    setDrafts({});setSuggested(false);setSummaryOpened(false);
    setData((current)=>{
      const assignments=current.allocations?.[nextShift]||{};
      const workers=current.workers.map((worker)=>({...worker,runningMinutes:0,assignedMachineId:worker.shift===nextShift?Object.keys(assignments).find((machineId)=>assignments[machineId]===worker.id)||null:null}));
      const machines=current.machines.map((machine)=>{
        const assigned=assignments[machine.id]||null;
        const operator=workers.find((worker)=>worker.id===assigned&&worker.present);
        const unavailable=['fault','maintenanceScheduled'].includes(machine.status);
        return {...machine,assignedWorkerId:assigned,status:unavailable?machine.status:'idle',downtimeStartedAt:null,downtimeReason:'No operator'};
      });
      const production=current.production.map((item)=>({...item,unitsMade:0}));
      return {...current,shift:nextShift,workers,machines,production,simulation:{...current.simulation,running:false,elapsedMinutes:0,completed:false,paceAlertSent:false,shiftStartedAt:Date.now(),downtimeByReason:{Breakdown:0,'No operator':0,'Material shortage':0,Changeover:0}},alerts:current.alerts.filter((alert)=>alert.code==='safetyIncident')};
    });
  }

  function resetDemo(){
    setData(createSeedData());setDrafts({});setSuggested(false);setSummaryOpened(false);setModal(null);setPage('Dashboard');
  }

  function simulateFault(machineId){
    setData((current)=>{
      const machine=current.machines.find((item)=>item.id===machineId);
      if(!machine)return current;
      const timestamp=new Date().toISOString();
      const machines=current.machines.map((item)=>item.id===machineId?{...item,status:'fault',faultHistory:[...item.faultHistory,{timestamp,cause:'Breakdown'}],downtimeStartedAt:current.simulation.elapsedMinutes,downtimeReason:'Breakdown',longDowntimeAlertSent:false,assignedWorkerId:null}:item);
      const workers=current.workers.map((worker)=>worker.id===machine.assignedWorkerId?{...worker,assignedMachineId:null}:worker);
      const allocations={...current.allocations};
      for(const shift of Object.keys(allocations))allocations[shift]={...allocations[shift],[machineId]:''};
      const alerts=uniqueAlert(current.alerts,'machineFault','critical',`${machine.name} fault reported`,{machineId,machineName:machine.name,dedupeKey:`fault:${machineId}:${timestamp}`});
      return {...current,machines,workers,allocations,alerts};
    });
    setDrafts({});setSuggested(false);
  }

  function stopMachine(machineId,reason){
    setData((current)=>({...current,machines:current.machines.map((machine)=>machine.id===machineId?{...machine,status:'idle',downtimeStartedAt:current.simulation.elapsedMinutes,downtimeReason:reason}:machine)}));
    setModal(null);
  }

  function scheduleMaintenance(machineId,scheduledAt){
    setData((current)=>({...current,machines:current.machines.map((machine)=>machine.id===machineId?{...machine,status:'maintenanceScheduled',scheduledAt}:machine)}));
    setModal(null);
  }

  function markFixed(machineId,cause){
    setData((current)=>({...current,machines:current.machines.map((machine)=>{
      if(machine.id!==machineId)return machine;
      const downtimeDuration=machine.downtimeStartedAt==null?0:Math.max(0,current.simulation.elapsedMinutes-machine.downtimeStartedAt);
      return {...machine,status:'idle',assignedWorkerId:null,serviceHistory:[{date:new Date().toISOString(),cause,downtimeDuration},...machine.serviceHistory],hoursSinceService:0,temperature:60,maintenanceState:null,serviceWarningSent:false,serviceCriticalSent:false,downtimeStartedAt:null,downtimeReason:'No operator',longDowntimeAlertSent:false,scheduledAt:null};
    })}));
    setModal(null);
  }

  function togglePresence(workerId){
    setData((current)=>{
      const worker=current.workers.find((item)=>item.id===workerId);
      if(!worker)return current;
      const becomingAbsent=worker.present;
      const machines=current.machines.map((machine)=>({...machine}));
      const assignments={...(current.allocations?.[worker.shift]||{})};
      let alerts=[...current.alerts];
      let message='';
      if(becomingAbsent){
        const assigned=machines.find((machine)=>machine.assignedWorkerId===worker.id);
        if(assigned){
          const used=new Set(machines.filter((machine)=>machine.id!==assigned.id).map((machine)=>machine.assignedWorkerId).filter(Boolean));
          const alternatives=current.workers.filter((candidate)=>candidate.id!==worker.id&&candidate.shift===worker.shift&&candidate.present&&!used.has(candidate.id)&&(candidate.skills[assigned.requiredSkill]||0)>=assigned.minLevel).sort((a,b)=>(b.skills[assigned.requiredSkill]-a.skills[assigned.requiredSkill])||a.incidentCount-b.incidentCount);
          const replacement=alternatives[0];
          assigned.assignedWorkerId=replacement?.id||null;
          if(!replacement&&assigned.status==='operating')assigned.status='idle';
          assignments[assigned.id]=replacement?.id||'';
          message=`${worker.name.split(' ')[0]} marked absent: suggested replacement ${replacement?.name.split(' ')[0]||'none available'}`;
          alerts=[{id:`replacement-${Date.now()}`,code:'workerShortage',severity:replacement?'info':'warning',message,createdAt:new Date().toISOString(),read:false},...alerts];
        }
      }
      const workers=current.workers.map((item)=>item.shift===worker.shift?{...item,present:item.id===worker.id?!item.present:item.present,assignedMachineId:Object.keys(assignments).find((machineId)=>assignments[machineId]===item.id)||null}:item);
      if(!becomingAbsent){const machine=machines.find((item)=>assignments[item.id]===worker.id);if(machine){machine.assignedWorkerId=worker.id;}}
      return {...current,workers,machines,allocations:{...current.allocations,[worker.shift]:assignments},alerts};
    });
    setDrafts({});setSuggested(false);
  }

  function getSuggestion(machine,excluded=new Set()){
    const candidates=shiftWorkers.filter((worker)=>worker.present&&!excluded.has(worker.id));
    const eligible=candidates.filter((worker)=>(worker.skills[machine.requiredSkill]||0)>=machine.minLevel).sort((a,b)=>b.skills[machine.requiredSkill]-a.skills[machine.requiredSkill]||a.incidentCount-b.incidentCount);
    if(eligible[0])return {workerId:eligible[0].id,reason:`${eligible[0].name.split(' ')[0]}: ${machine.requiredSkill} level ${eligible[0].skills[machine.requiredSkill]}, present, ${eligible[0].incidentCount} incidents`,alternative:null};
    const alternatives=candidates.flatMap((worker)=>{
      const level=worker.skills[machine.requiredSkill]||0;
      if(level>0&&level<machine.minLevel)return [{worker,skill:machine.requiredSkill,level}];
      return (relatedSkills[machine.requiredSkill]||[]).filter((skill)=>worker.skills[skill]).map((skill)=>({worker,skill,level:worker.skills[skill]}));
    }).sort((a,b)=>b.level-a.level||a.worker.incidentCount-b.worker.incidentCount);
    return {workerId:null,reason:'No worker meets this machine’s skill requirement.',alternative:alternatives[0]?`${alternatives[0].worker.name} (${alternatives[0].skill} level ${alternatives[0].level})`:'No present worker has a related skill.'};
  }

  function suggestAllocation(){
    const next={},used=new Set(),newAlerts=[];
    for(const machine of data.machines){
      if(machine.status==='fault'||machine.status==='maintenanceScheduled'){next[machine.id]={workerId:null,reason:'Machine unavailable.',alternative:null};continue;}
      const suggestion=getSuggestion(machine,used);next[machine.id]=suggestion;
      if(suggestion.workerId)used.add(suggestion.workerId);
      else newAlerts.push({id:`unstaffed-${machine.id}-${Date.now()}`,code:'workerShortage',severity:'warning',message:`No eligible worker for ${machine.name}`,createdAt:new Date().toISOString(),read:false,dedupeKey:`unstaffed:${data.shift}:${machine.id}`});
    }
    setDrafts(next);setSuggested(true);
    setData((current)=>({...current,alerts:[...current.alerts.filter((alert)=>!alert.dedupeKey?.startsWith(`unstaffed:${current.shift}:`)),...newAlerts]}));
  }

  function pickOverride(machine,workerId){
    const worker=data.workers.find((item)=>item.id===workerId);
    const usedElsewhere=data.machines.find((item)=>item.id!==machine.id&&(drafts[item.id]?.workerId||allocations[item.id])===workerId);
    if(workerId&&usedElsewhere){setToast(`${worker.name} is already assigned to another machine.`);return;}
    setDrafts((current)=>({...current,[machine.id]:workerId?{workerId,reason:`Manager selected ${worker.name.split(' ')[0]}.`,alternative:null}:getSuggestion(machine,new Set(Object.entries(current).filter(([id])=>id!==machine.id).map(([,draft])=>draft.workerId).filter(Boolean)))}));
  }

  function confirmAllocation(){
    const ids=Object.values(drafts).map((draft)=>draft.workerId).filter(Boolean);
    if(new Set(ids).size!==ids.length){setToast('A worker can only run one machine per shift.');return;}
    setData((current)=>{
      const allocation=Object.fromEntries(current.machines.map((machine)=>[machine.id,drafts[machine.id]?.workerId||'']));
      const machines=current.machines.map((machine)=>({...machine,assignedWorkerId:allocation[machine.id]||null,status:allocation[machine.id]&&current.simulation.running?'operating':machine.status==='fault'||machine.status==='maintenanceScheduled'?machine.status:'idle'}));
      const workers=current.workers.map((worker)=>worker.shift===current.shift?{...worker,assignedMachineId:Object.keys(allocation).find((id)=>allocation[id]===worker.id)||null}:worker);
      return {...current,allocations:{...current.allocations,[current.shift]:allocation},machines,workers};
    });
    setToast('Allocation confirmed and saved');
  }

  function submitReport(){
    if(!reportForm.type||!reportForm.location)return;
    const incident={id:`i-${Date.now()}`,type:reportForm.type,location:reportForm.location,note:reportForm.note,status:'open',createdAt:new Date().toISOString(),shift:data.shift,shiftElapsedMinute:data.simulation.elapsedMinutes};
    const severity=reportForm.type==='Injury'?'critical':'warning';
    setData((current)=>({...current,incidents:[incident,...current.incidents],alerts:uniqueAlert(current.alerts,'safetyIncident',severity,`${reportForm.type} reported at ${reportForm.location}`,{incidentType:reportTypeKeys[reportForm.type],location:reportForm.location,incidentId:incident.id,dedupeKey:`incident:${incident.id}`} )}));
    setReportForm({type:'',location:'',note:''});setModal(null);setToast('Incident reported');
  }

  function closeIncident(incidentId){setData((current)=>({...current,incidents:current.incidents.map((incident)=>incident.id===incidentId?{...incident,status:'closed',closedAt:new Date().toISOString()}:incident)}));}

  function demoAbsent(){const worker=shiftWorkers.find((item)=>item.present);if(worker)togglePresence(worker.id);}
  function demoFault(){const machine=data.machines.find((item)=>item.status==='operating')||data.machines.find((item)=>item.status==='idle');if(machine)simulateFault(machine.id);}
  function demoNearMiss(){setReportForm({type:'Near-miss',location:'',note:''});setModal({type:'report-location'});}

  const clock=formatClock(data.shift,elapsed);
  const shiftEnd=formatClock(data.shift,shiftLength);
  const progress=Math.min(100,Math.round(elapsed/shiftLength*100));
  const recentAlerts=[...data.alerts].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu?'mobile-open':''}`}>
      <a className="brand" href="#factorypulse" onClick={(event)=>{event.preventDefault();navigate('Dashboard');}}><span className="brand-mark"><Factory size={20}/></span><span>Factory<span className="brand-light">Pulse</span><small>SHOP FLOOR CONTROL</small></span></a>
      <div className="plant-select"><span className="plant-icon"><Factory size={18}/></span><span><b>Rajkot Works</b><small>Gujarat, India</small></span><ChevronDown size={15}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{navItems.map(({id,key,icon:Icon})=><button type="button" key={id} className={`nav-link ${page===id?'active':''}`} onClick={()=>navigate(id)}><Icon size={18}/><span>{t(key)}</span>{id==='Alerts'&&unreadCount>0&&<span className="nav-badge">{unreadCount}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="shift-chip"><span className="live-dot"/><span>{data.shift} shift · {t(data.simulation.running?'running':data.simulation.completed?'shiftComplete':'paused')}</span></div><button type="button" className={`nav-link ${page==='Settings'?'active':''}`} onClick={()=>navigate('Settings')}><Settings size={18}/><span>{t('navSettings')}</span></button><div className="user-profile"><div className="avatar avatar-purple">AS</div><span><b>Admin Supervisor</b><small>Plant manager</small></span></div></div>
    </aside>
    {mobileMenu&&<button type="button" className="sidebar-backdrop" aria-label="Close menu" onClick={()=>setMobileMenu(false)}/>}
    <div className="main-column">
      <header className="topbar"><button className="menu-button" onClick={()=>setMobileMenu((open)=>!open)} aria-label="Open menu"><Menu size={21}/></button><div className="breadcrumb"><span>Rajkot Works</span><span className="crumb-slash">/</span><b>{t(navItems.find((item)=>item.id===page)?.key||'navSettings')}</b></div><div className="topbar-actions"><button className="icon-button notification-button" aria-label={`${unreadCount} ${t('unread')} ${t('navAlerts')}`} onClick={()=>navigate('Alerts')}><Bell size={19}/>{unreadCount>0&&<i/>}</button><button className="icon-button theme-toggle" onClick={toggleTheme} aria-label={darkMode?'Switch to light mode':'Switch to dark mode'}>{darkMode?<Sun size={19}/>:<Moon size={19}/>}</button><div className="avatar avatar-green">AS</div></div></header>
      <div className="simulation-toolbar"><div className="shift-clock"><Clock3 size={17}/><b>{clock}</b><span>→ {shiftEnd}</span><div className="clock-progress"><i style={{width:`${progress}%`}}/></div><small>{progress}%</small></div><div className="simulation-controls"><button className="start-button" onClick={startProduction} disabled={data.simulation.running||data.simulation.completed}><Play size={15}/>{t('start')}</button><button className="pause-button" onClick={pauseProduction} disabled={!data.simulation.running}><Pause size={15}/>{t('pause')}</button><button className="reset-button" onClick={resetShift}><RotateCcw size={15}/>{t('reset')}</button><button className="speed-button" onClick={()=>setData((current)=>({...current,simulation:{...current.simulation,speed:current.simulation.speed===1?3:1}}))}>{data.simulation.speed}x</button></div></div>
      <main className="content">
        <div className="page-heading"><div><div className="eyebrow"><span className="live-dot"/>RAJKOT WORKS · {data.shift.toUpperCase()} SHIFT</div><h1>{t(navItems.find((item)=>item.id===page)?.key||'navSettings')}</h1><p>{page==='Dashboard'?'Live factory operations · Simulated demo data':`${data.shift} shift · ${new Date().toLocaleDateString()}`}</p></div><div className="heading-clock"><span>{t('startTime')}</span><b>{clock}</b><small>{data.simulation.running?t('running'):data.simulation.completed?t('shiftComplete'):t('paused')}</small></div></div>
        {toast&&<div className="toast"><Check size={16}/><span>{toast}</span><button onClick={()=>setToast('')}>×</button></div>}
        {data.alerts.find((alert)=>alert.severity==='info'&&alert.message.includes('marked absent'))&&<div className="replacement-banner"><ArrowDownRight size={17}/><span>{data.alerts.find((alert)=>alert.severity==='info'&&alert.message.includes('marked absent')).message}</span><button onClick={()=>setData((current)=>({...current,alerts:current.alerts.filter((alert)=>!alert.message.includes('marked absent'))}))}>×</button></div>}

        {page==='Dashboard'&&<section className="dashboard-grid">
          <article className="dash-card"><CardTitle icon={Users} title={t('whoWorking')}/><strong className="metric-value">{shiftWorkers.filter((worker)=>worker.present).length}<small>/{shiftWorkers.length} {t('present').toLowerCase()}</small></strong><p>{data.machines.filter((machine)=>machine.assignedWorkerId&&machine.status==='operating').length} {t('navWorkers').toLowerCase()} assigned to running machines</p></article>
          <article className="dash-card"><CardTitle icon={Gauge} title={t('machineRunning')}/><div className="status-counts"><span className="good">{data.machines.filter((machine)=>machine.status==='operating').length} {t('operating')}</span><span className="warn">{data.machines.filter((machine)=>machine.status==='idle').length} {t('idle')}</span><span className="bad">{data.machines.filter((machine)=>machine.status==='fault').length} {t('fault')}</span></div><div className="compact-list">{data.machines.map((machine)=><div className="compact-row" key={machine.id}><span>{machine.name}</span><StatusPill machine={machine} t={t}/></div>)}</div></article>
          <article className="dash-card"><CardTitle icon={Activity} title={t('whatProduced')}/>{operatingMachines.length?operatingMachines.map((machine)=><div className="compact-row" key={machine.id}><span>{data.production.find((item)=>item.machineId===machine.id)?.product||machine.product}</span><small>{machine.name}</small></div>):<EmptyState text={t('empty')}/>}</article>
          <article className="dash-card"><CardTitle icon={ClipboardList} title={t('howMuchProduced')}/><div className="output-summary"><strong>{totalUnits}</strong><span>/ {totalTarget} {t('units')}</span><b>{outputPercent}%</b></div><ProgressBar value={outputPercent}/><div className={`pace-line ${paceGap?'pace-behind':'pace-good'}`}>{paceGap?`${t('behindPace')} ${paceGap}%`:`✓ ${t('onPace')}`}</div><small>{t('actual')} {totalUnits} · {t('target')} {totalTarget}</small></article>
          <article className={`dash-card safety-card ${openIncidents.length?'has-safety-issue':''}`}><CardTitle icon={ShieldCheck} title={t('safetyIssue')}/><strong className="metric-value">{openIncidents.length}<small> open</small></strong>{openIncidents.length>0&&<div className="safety-latest"><b>{t('openIncident')}</b><span>{openIncidents[0].type} · {openIncidents[0].location}</span></div>}<button className="text-link" onClick={()=>navigate('Safety')}>{t('navSafety')} →</button></article>
          <article className="dash-card"><CardTitle icon={Wrench} title={t('needsMaintenance')}/>{maintenanceMachines.length?maintenanceMachines.map((machine)=><div className="compact-row" key={machine.id}><span>{machine.name}</span><MaintenanceBadges machine={machine} t={t}/></div>):<EmptyState text={t('empty')}/>}</article>
          <article className="dash-card alerts-card"><CardTitle icon={Bell} title={t('alertsRecent')}/>{recentAlerts.length?recentAlerts.map((alert)=><AlertRow key={alert.id} alert={alert} t={t}/>):<EmptyState text={t('noAlerts')}/>}<button className="text-link" onClick={()=>navigate('Alerts')}>{t('navAlerts')} →</button></article>
        </section>}

        {page==='Workers'&&<><section className="section-card"><SectionTitle title={t('shiftCrew')} detail={`${shiftWorkers.length} workers · ${shiftWorkers.filter((worker)=>worker.present).length} ${t('present').toLowerCase()}`}><div className="shift-toggle"><button className={data.shift==='Morning'?'selected':''} onClick={()=>changeShift('Morning')}>Morning</button><button className={data.shift==='Afternoon'?'selected':''} onClick={()=>changeShift('Afternoon')}>Afternoon</button></div></SectionTitle><div className="worker-table">{shiftWorkers.map((worker)=><div className="worker-table-row" key={worker.id}><div className="avatar avatar-purple">{worker.short}</div><div className="worker-cell"><b>{worker.name}</b><small>{Object.keys(worker.skills).join(' · ')} · {worker.incidentCount} incidents</small></div><span className={`worker-assignment ${worker.assignedMachineId?'':'subtle'}`}>{data.machines.find((machine)=>machine.id===worker.assignedMachineId)?.name||'Available'}</span><button role="switch" aria-checked={worker.present} className={`presence-toggle ${worker.present?'is-present':''}`} onClick={()=>togglePresence(worker.id)}>{worker.present?t('present'):t('absent')}</button></div>)}</div></section><section className="section-card skills-section"><SectionTitle title="Skills matrix" detail="Team coverage · ! single point of failure"/><div className="matrix-wrap"><table><thead><tr><th>Worker</th>{skills.map((skill)=><th key={skill}>{skill}{soleSkills.has(skill)&&<b className="single-mark" title="Single point of failure">!</b>}</th>)}</tr></thead><tbody>{data.workers.map((worker)=><tr key={worker.id}><td>{worker.name}</td>{skills.map((skill)=><td key={skill}>{worker.skills[skill]?<span className={`skill-pill ${soleSkills.has(skill)?'skill-single':''}`}>L{worker.skills[skill]}</span>:'—'}</td>)}</tr>)}</tbody></table></div></section></>}

        {page==='Shift Planner'&&<><section className="section-card"><SectionTitle title="Choose a shift" detail="Select the crew to plan"><div className="shift-toggle"><button className={data.shift==='Morning'?'selected':''} onClick={()=>changeShift('Morning')}>☀ Morning · 06:00–14:00</button><button className={data.shift==='Afternoon'?'selected':''} onClick={()=>changeShift('Afternoon')}>◐ Afternoon · 14:00–22:00</button></div></SectionTitle><div className="worker-table">{shiftWorkers.map((worker)=><div className="worker-table-row" key={worker.id}><div className="avatar avatar-purple">{worker.short}</div><div className="worker-cell"><b>{worker.name}</b><small>{Object.keys(worker.skills).join(' · ')} · {worker.incidentCount} incidents</small></div><button role="switch" aria-checked={worker.present} className={`presence-toggle ${worker.present?'is-present':''}`} onClick={()=>togglePresence(worker.id)}>{worker.present?t('present'):t('absent')}</button></div>)}</div></section><section className="section-card"><SectionTitle title="Machine allocation" detail="One worker can operate one machine"><button className="suggest-button" onClick={suggestAllocation}><Sparkles size={16}/>Suggest allocation</button></SectionTitle><div className="machine-list">{data.machines.map((machine)=><MachineCard key={machine.id} machine={machine} worker={data.workers.find((worker)=>worker.id===machine.assignedWorkerId)} t={t} elapsed={elapsed} onFault={()=>simulateFault(machine.id)} onStop={()=>setModal({type:'stop',machineId:machine.id})} onOverride={(workerId)=>pickOverride(machine,workerId)} workers={shiftWorkers.filter((worker)=>worker.present)} draft={drafts[machine.id]} suggested={suggested}/>)}</div><div className="allocation-footer"><span><CircleHelp size={15}/>Skill level, then incident count</span><button className="confirm-button" disabled={!suggested} onClick={confirmAllocation}><Check size={16}/>Confirm allocation</button></div></section></>}

        {page==='Machines'&&<section className="section-card"><SectionTitle title="Machine status" detail={`${data.machines.length} machines · Fault simulation is available`}><button className="suggest-button" onClick={suggestAllocation}><Sparkles size={16}/>Suggest allocation</button></SectionTitle><div className="machine-list">{data.machines.map((machine)=><MachineCard key={machine.id} machine={machine} worker={data.workers.find((worker)=>worker.id===machine.assignedWorkerId)} t={t} elapsed={elapsed} onFault={()=>simulateFault(machine.id)} onStop={()=>setModal({type:'stop',machineId:machine.id})} onOverride={(workerId)=>pickOverride(machine,workerId)} workers={shiftWorkers.filter((worker)=>worker.present)} draft={drafts[machine.id]} suggested={suggested}/>)}</div><div className="allocation-footer"><span><CircleHelp size={15}/>Use Shift Planner to confirm an allocation</span><button className="confirm-button" disabled={!suggested} onClick={confirmAllocation}><Check size={16}/>Confirm allocation</button></div>{!data.machines.length&&<EmptyState text={t('empty')}/>}</section>}

        {page==='Production'&&<section className="section-card"><SectionTitle title={t('productionToday')} detail={`${totalUnits} / ${totalTarget} ${t('units')}`}/>{data.production.length?data.production.map((item)=>{const machine=data.machines.find((entry)=>entry.id===item.machineId);const percent=item.target?Math.min(100,Math.round(item.unitsMade/item.target*100)):0;return <div className="production-item" key={item.id}><div className="production-heading"><span><b>{item.product}</b><small>{machine?.name||'Production line'} · {machine?t(statusKeys[machine.status]||'idle'):''}</small></span><strong>{item.unitsMade} / {item.target}</strong></div><ProgressBar value={percent}/></div>}):<EmptyState text={t('empty')}/>}</section>}

        {page==='Safety'&&<><section className="section-card"><SectionTitle title={t('navSafety')} detail={`${openIncidents.length} open · ${data.incidents.length} total`}><select className="filter-select" value={incidentFilter} onChange={(event)=>setIncidentFilter(event.target.value)}><option>All</option>{reportTypes.map((type)=><option key={type}>{type}</option>)}</select></SectionTitle>{openIncidents.length>0&&<div className="safety-banner"><Siren size={18}/><span>{openIncidents.length} open safety incident{openIncidents.length===1?'':'s'}</span></div>}<p className="near-miss-count">{t('nearMissesWeek')}: {data.incidents.filter((incident)=>incident.type==='Near-miss'&&Date.now()-new Date(incident.createdAt).getTime()<=7*86400000).length}</p><div className="incident-list">{data.incidents.filter((incident)=>incidentFilter==='All'||incident.type===incidentFilter).sort((a,b)=>(a.status==='open'?-1:1)-(b.status==='open'?-1:1)||new Date(b.createdAt)-new Date(a.createdAt)).map((incident)=><article className="incident-row" key={incident.id}><span className={`severity-mark ${incident.type==='Injury'?'critical':'warning'}`}/><div className="incident-info"><b>{incident.type} · {incident.location}</b><small>{new Date(incident.createdAt).toLocaleString()} · {incident.status}</small>{incident.note&&<p>{incident.note}</p>}</div>{incident.status==='open'&&<button className="small-action" onClick={()=>closeIncident(incident.id)}>{t('closeIncident')}</button>}</article>)}{!data.incidents.filter((incident)=>incidentFilter==='All'||incident.type===incidentFilter).length&&<EmptyState text={t('noIncidents')}/>}</div></section><section className="section-card"><SectionTitle title="Worker incident counts" detail="Recorded reports"/>{data.workers.map((worker)=><div className="module-row" key={worker.id}><span><b>{worker.name}</b><small>{worker.shift} shift</small></span><b>{worker.incidentCount+data.incidents.filter((incident)=>incident.workerId===worker.id).length}</b></div>)}</section></>}

        {page==='Maintenance'&&<section className="section-card"><SectionTitle title={t('navMaintenance')} detail="Sorted by service and fault urgency"/><div className="maintenance-list">{[...data.machines].sort((a,b)=>maintenancePriority(a)-maintenancePriority(b)).map((machine)=><article className="maintenance-card" key={machine.id}><div className="maintenance-heading"><div><h3>{machine.name}</h3><p>{machine.code} · {machine.area}</p></div><div className="badge-stack"><StatusPill machine={machine} t={t}/><MaintenanceBadges machine={machine} t={t}/></div></div><div className="maintenance-data"><span>{machine.hoursSinceService.toFixed(1)} / {machine.serviceInterval} {t('hours')} · {t('temperature')} {machine.temperature}°</span><span>{t('faults30Days')}: {recentFaultCount(machine)}</span></div>{machine.status==='fault'&&<button className="small-action" onClick={()=>setModal({type:'schedule',machineId:machine.id,date:localDateTime(new Date(Date.now()+86400000))})}>{t('scheduleMaintenance')}</button>}{(machine.status==='fault'||machine.status==='maintenanceScheduled')&&<button className="small-action secondary" onClick={()=>setModal({type:'fix',machineId:machine.id,cause:'Mechanical'})}>{t('markFixed')}</button>}{machine.status==='maintenanceScheduled'&&<p className="scheduled-note">{t('scheduled')}: {machine.scheduledAt?new Date(machine.scheduledAt).toLocaleString():''}</p>}<div className="service-history"><b>{t('serviceHistory')}</b>{machine.serviceHistory.length?machine.serviceHistory.map((entry,index)=><small key={`${entry.date}-${index}`}>{new Date(entry.date).toLocaleDateString()} · {entry.cause} · {entry.downtimeDuration} min downtime</small>):<small>{t('empty')}</small>}</div></article>)}</div>{!data.machines.length&&<EmptyState text={t('empty')}/>}</section>}

        {page==='Alerts'&&<section className="section-card"><SectionTitle title={t('navAlerts')} detail={`${unreadCount} ${t('unread')}`}><button className="confirm-button" onClick={()=>setData((current)=>({...current,alerts:current.alerts.map((alert)=>({...alert,read:true}))}))}>{t('markRead')}</button></SectionTitle><div className="alert-list">{[...data.alerts].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map((alert)=><AlertRow key={alert.id} alert={alert} t={t} onClick={()=>setData((current)=>({...current,alerts:current.alerts.map((item)=>item.id===alert.id?{...item,read:true}:item)}))}/>)}</div>{!data.alerts.length&&<EmptyState text={t('noAlerts')}/>}</section>}

        {page==='Shift Summary'&&<ShiftSummary data={data} t={t} totalUnits={totalUnits} totalTarget={totalTarget} incidents={thisShiftIncidents} onNavigate={navigate}/>}

        {page==='Settings'&&<section className="section-card settings-screen"><SectionTitle title={t('navSettings')} detail="Demo preferences"/><div className="settings-row"><span><b>{t('language')}</b><small>English / मराठी / हिंदी</small></span><select value={lang} onChange={(event)=>setData((current)=>({...current,language:event.target.value}))}><option value="en">English</option><option value="mr">मराठी</option><option value="hi">हिंदी</option></select></div><div className="settings-row"><span><b>Appearance</b><small>Minimal charcoal dark mode</small></span><button className="confirm-button" onClick={toggleTheme}>{darkMode?<Sun size={16}/>:<Moon size={16}/>} {darkMode?'Light mode':'Dark mode'}</button></div><div className="settings-row"><span><b>{t('demoMode')}</b><small>Clear simulation activity and restore seed data</small></span><button className="danger-button" onClick={()=>setModal({type:'resetDemo'})}>{t('resetDemo')}</button></div></section>}

        <footer className="page-footer"><span>FactoryPulse · {t('dashboard')}</span><span>All data is simulated · Saved on this device</span></footer>
      </main>
      <button className="report-fab" onClick={()=>{setReportForm({type:'',location:'',note:''});setModal({type:'report-type'});}}><ShieldCheck size={18}/>{t('report')}</button>
      <nav className="mobile-tabs">{[{page:'Dashboard',label:'Home',icon:LayoutDashboard},{page:'Workers',label:'Workers',icon:Users},{page:'Machines',label:'Machines',icon:Factory},{page:'Shift Planner',label:'Planner',icon:ClipboardList},{page:null,label:'More',icon:Menu}].map(({page:target,label,icon:Icon})=><button key={label} className={page===target?'tab-active':''} onClick={()=>target?navigate(target):setMobileMenu(true)}><Icon size={19}/><span>{label==='Home'?t('navOverview'):label==='Planner'?t('navPlanner'):label}</span></button>)}</nav>
    </div>

    <button className="demo-toggle" onClick={()=>setDemoOpen((open)=>!open)}>{demoOpen?t('hideDemo'):t('showDemo')}</button>
    {demoOpen&&<div className="demo-panel"><b>{t('demoMode')}</b><button onClick={demoAbsent}>{t('markAbsent')}</button><button onClick={demoFault}>{t('simulateFault')}</button><button onClick={demoNearMiss}>{t('addNearMiss')}</button></div>}

    {modal&&<div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setModal(null);}}><section className="modal-card" role="dialog" aria-modal="true">
      <button className="modal-close" onClick={()=>setModal(null)} aria-label="Close"><X size={18}/></button>
      {modal.type==='report-type'&&<><h2>{t('reportIncident')}</h2><p>{t('chooseType')}</p><div className="choice-grid">{reportTypes.map((type)=><button key={type} onClick={()=>{setReportForm((current)=>({...current,type}));setModal({type:'report-location'});}}>{t(reportTypeKeys[type])}</button>)}</div><button className="text-link" onClick={()=>setModal(null)}>{t('cancel')}</button></>}
      {modal.type==='report-location'&&<><h2>{t('reportIncident')}</h2><p>{t('chooseLocation')}</p><div className="choice-grid location-grid">{[...data.machines.map((machine)=>machine.name),'Shop floor','Loading area','Other location'].map((location)=><button className={reportForm.location===location?'selected':''} key={location} onClick={()=>setReportForm((current)=>({...current,location}))}>{location}</button>)}</div><textarea className="note-input" placeholder={t('optionalNote')} value={reportForm.note} onChange={(event)=>setReportForm((current)=>({...current,note:event.target.value}))}/><div className="modal-actions"><button className="reset-button" onClick={()=>setModal({type:'report-type'})}>← {t('cancel')}</button><button className="start-button" disabled={!reportForm.location} onClick={submitReport}>{t('submit')}</button></div></>}
      {modal.type==='stop'&&<><h2>Stop {data.machines.find((machine)=>machine.id===modal.machineId)?.name}</h2><p>Choose the reason for downtime.</p><div className="choice-grid">{downtimeReasons.map((reason)=><button key={reason} onClick={()=>stopMachine(modal.machineId,reason)}>{reason}</button>)}</div></>}
      {modal.type==='schedule'&&<><h2>{t('scheduleMaintenance')}</h2><p>{data.machines.find((machine)=>machine.id===modal.machineId)?.name}</p><label className="form-field">Date and time<input type="datetime-local" value={modal.date} onChange={(event)=>setModal((current)=>({...current,date:event.target.value}))}/></label><button className="start-button full-button" onClick={()=>scheduleMaintenance(modal.machineId,modal.date)}>{t('scheduleMaintenance')}</button></>}
      {modal.type==='fix'&&<><h2>{t('markFixed')}</h2><label className="form-field">{t('cause')}<select value={modal.cause} onChange={(event)=>setModal((current)=>({...current,cause:event.target.value}))}>{fixCauses.map((cause)=><option key={cause}>{cause}</option>)}</select></label><button className="start-button full-button" onClick={()=>markFixed(modal.machineId,modal.cause)}>{t('markFixed')}</button></>}
      {modal.type==='resetDemo'&&<><h2>{t('resetDemo')}</h2><p>{t('resetConfirm')}</p><div className="modal-actions"><button className="reset-button" onClick={()=>setModal(null)}>{t('cancel')}</button><button className="danger-button" onClick={resetDemo}>{t('resetDemo')}</button></div></>}
    </section></div>}
  </div>;
}

function CardTitle({icon:Icon,title}){return <div className="dash-card-title"><span className="title-icon"><Icon size={17}/></span><h2>{title}</h2></div>;}
function SectionTitle({title,detail,children}){return <div className="section-header"><div><h2>{title}</h2>{detail&&<small>{detail}</small>}</div>{children}</div>;}
function EmptyState({text}){return <div className="empty-state">{text}</div>;}
function ProgressBar({value}){return <div className="progress-track"><i style={{width:`${Math.max(0,Math.min(100,value))}%`}}/></div>;}
function StatusPill({machine,t}){return <span className={`status-pill ${machine.status==='fault'?'critical':machine.status==='operating'?'good':machine.status==='maintenanceScheduled'?'scheduled':'idle'}`}>{t(statusKeys[machine.status]||'idle')}</span>;}
function MaintenanceBadges({machine,t}){return <>{machine.maintenanceState&&<span className={`maintenance-badge ${machine.maintenanceState}`}>{t(machine.maintenanceState==='dueSoon'?'dueSoon':'overdue')}</span>}{isChronic(machine)&&<span className="chronic-badge">{t('chronic')}</span>}</>;}
function AlertRow({alert,t,onClick}){return <button className={`alert-row ${alert.read?'is-read':''}`} onClick={onClick}><span className={`severity-mark ${alert.severity}`}/><span className="alert-copy"><b>{tAlert(alert,t)}</b><small>{new Date(alert.createdAt).toLocaleString()}</small></span>{!alert.read&&<i className="unread-dot"/>}</button>;}

function MachineCard({machine,worker,t,onFault,onStop,onOverride,workers,draft,suggested,elapsed=0}){
  const assigned=draft?workers.find((item)=>item.id===draft.workerId):worker;
  const downtime=machine.downtimeStartedAt==null?0:Math.max(0,elapsed-machine.downtimeStartedAt);
  return <article className="machine-card"><div className="machine-card-top"><div className={`machine-icon ${machine.status}`}><Gauge size={19}/></div><div className="machine-info"><h3>{machine.name}</h3><p>{machine.code} · {machine.area}</p></div><StatusPill machine={machine} t={t}/></div><div className="machine-data"><span>Needs {machine.requiredSkill} L{machine.minLevel}+</span><span>{machine.temperature}° <Thermometer size={13}/></span><span>{machine.unitsMade} units</span>{machine.status==='fault'&&<span>Down {downtime} simulated min</span>}</div><div className="machine-operator"><span>Operator</span><b>{assigned?.name||'Unstaffed'}</b></div>{suggested&&draft&&<p className="suggestion-reason">{draft.reason}{draft.alternative&&` Closest: ${draft.alternative}`}</p>}<div className="machine-actions"><label className="override-select"><span>Override</span><select aria-label={`Assign worker to ${machine.name}`} value={draft?draft.workerId||'':worker?.id||''} onChange={(event)=>onOverride(event.target.value)}><option value="">Choose worker</option>{workers.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={14}/></label>{machine.status==='operating'&&<button className="small-action secondary" onClick={onStop}>Stop</button>}<button className="small-action fault-action" disabled={machine.status==='fault'} onClick={onFault}>{t('simulateFault')}</button></div><div className="machine-foot"><MaintenanceBadges machine={machine} t={t}/><span>{machine.hoursSinceService.toFixed(1)} / {machine.serviceInterval} h</span></div></article>;
}

function maintenancePriority(machine){if(machine.maintenanceState==='overdue')return 0;if(machine.maintenanceState==='dueSoon')return 1;if(machine.status==='fault'||machine.status==='maintenanceScheduled')return 2;if(isChronic(machine))return 3;return 4;}

function ShiftSummary({data,t,totalUnits,totalTarget,incidents,onNavigate}){
  const totalDowntime=totalOf(data.machines,'downtimeMinutes');
  const downtimeBreakdown=data.simulation.downtimeByReason;
  const topReason=Object.entries(downtimeBreakdown).sort((a,b)=>b[1]-a[1])[0];
  const topMachine=[...data.machines].sort((a,b)=>b.downtimeMinutes-a.downtimeMinutes)[0];
  const insight=topMachine&&topMachine.downtimeMinutes?`Most downtime came from ${topMachine.name} (${topReason?.[0]?.toLowerCase()||'breakdown'}).`:'Production ran without recorded downtime.';
  const maxReason=Math.max(1,...Object.values(downtimeBreakdown));
  return <div className="summary-grid"><section className="section-card summary-main"><SectionTitle title={t('shiftComplete')} detail={`${data.shift} shift · ${formatClock(data.shift,data.simulation.elapsedMinutes)}`}/><div className="summary-total"><b>{totalUnits}</b><span>/ {totalTarget} {t('units')} · {totalTarget?Math.round(totalUnits/totalTarget*100):0}%</span></div><ProgressBar value={totalTarget?totalUnits/totalTarget*100:0}/></section><section className="section-card"><SectionTitle title={t('downtime')} detail={`${totalDowntime} simulated minutes total`}/>{data.machines.map((machine)=><div className="module-row" key={machine.id}><span>{machine.name}</span><b>{machine.downtimeMinutes} min</b></div>)}</section><section className="section-card"><SectionTitle title={t('downtimeReason')}/>{Object.entries(downtimeBreakdown).map(([reason,minutes])=><div className="chart-row" key={reason}><span>{reason}</span><div className="progress-track"><i style={{width:`${minutes/maxReason*100}%`}}/></div><b>{minutes}m</b></div>)}</section><section className="section-card"><SectionTitle title={t('utilisation')}/>{data.workers.filter((worker)=>worker.shift===data.shift&&worker.present).map((worker)=><div className="chart-row" key={worker.id}><span>{worker.name}</span><div className="progress-track"><i style={{width:`${Math.min(100,worker.runningMinutes/(data.simulation.shiftLengthMinutes||480)*100)}%`}}/></div><b>{Math.round(worker.runningMinutes/(data.simulation.shiftLengthMinutes||480)*100)}%</b></div>)}</section><section className="section-card"><SectionTitle title={t('incidentsThisShift')} detail={`${incidents.length} reported`}/>{incidents.length?incidents.map((incident)=><div className="module-row" key={incident.id}><span>{incident.type} · {incident.location}</span><b>{incident.status}</b></div>):<EmptyState text={t('noIncidents')}/>}</section><section className="section-card"><SectionTitle title={t('maintenanceNeed')}/>{data.machines.filter((machine)=>machine.maintenanceState||machine.status==='fault'||isChronic(machine)).map((machine)=><div className="module-row" key={machine.id}><span>{machine.name}</span><MaintenanceBadges machine={machine} t={t}/></div>)}</section><section className="insight-card"><b>{t('insight')}</b><p>{insight}</p><button className="text-link" onClick={()=>onNavigate('Dashboard')}>Back to dashboard →</button></section></div>;
}

