const minsPerShift = 480;

export function createSeedData() {
  const now = Date.now();
  return {
    shift: 'Morning',
    workers: [
      { id:'w1',name:'Ravi Kumar',short:'RK',shift:'Morning',present:true,incidentCount:0,skills:{CNC:3,Welding:1},runningMinutes:0,assignedMachineId:'m1' },
      { id:'w2',name:'Sunil Patel',short:'SP',shift:'Morning',present:true,incidentCount:1,skills:{CNC:2,Assembly:2},runningMinutes:0,assignedMachineId:null },
      { id:'w3',name:'Meena Devi',short:'MD',shift:'Morning',present:true,incidentCount:0,skills:{Welding:3,Quality:2},runningMinutes:0,assignedMachineId:'m2' },
      { id:'w4',name:'Arjun Singh',short:'AS',shift:'Morning',present:true,incidentCount:2,skills:{Assembly:3,CNC:1},runningMinutes:0,assignedMachineId:'m3' },
      { id:'w5',name:'Priya Sharma',short:'PS',shift:'Afternoon',present:true,incidentCount:0,skills:{Quality:3,CNC:2},runningMinutes:0,assignedMachineId:'m4' },
      { id:'w6',name:'Imran Khan',short:'IK',shift:'Afternoon',present:true,incidentCount:1,skills:{Welding:2,Assembly:2},runningMinutes:0,assignedMachineId:'m2' },
      { id:'w7',name:'Kavita Rao',short:'KR',shift:'Afternoon',present:true,incidentCount:0,skills:{Quality:2,CNC:1,Forklift:1},runningMinutes:0,assignedMachineId:null },
    ],
    machines: [
      { id:'m1',name:'CNC Milling 01',code:'CNC-01',requiredSkill:'CNC',minLevel:2,area:'Machining',status:'idle',assignedWorkerId:'w1',product:'Precision shaft',target:120,unitsMade:0,ratePerHour:15,hoursSinceService:0,serviceInterval:60,temperature:64,faultHistory:[],serviceHistory:[],downtimeMinutes:0,downtimeStartedAt:null,downtimeReason:'No operator',serviceWarningSent:false,serviceCriticalSent:false,hotAlertSent:false,longDowntimeAlertSent:false,nextMaintenance:'28 Nov 2026' },
      { id:'m2',name:'Arc Welder 03',code:'WLD-03',requiredSkill:'Welding',minLevel:2,area:'Fabrication',status:'idle',assignedWorkerId:'w3',product:'Welded frame',target:80,unitsMade:0,ratePerHour:10,hoursSinceService:0,serviceInterval:60,temperature:61,faultHistory:[{timestamp:new Date(now-21*86400000).toISOString(),cause:'Electrical'},{timestamp:new Date(now-12*86400000).toISOString(),cause:'Wear'},{timestamp:new Date(now-4*86400000).toISOString(),cause:'Mechanical'}],serviceHistory:[],downtimeMinutes:0,downtimeStartedAt:null,downtimeReason:'Breakdown',serviceWarningSent:false,serviceCriticalSent:false,hotAlertSent:false,longDowntimeAlertSent:false,nextMaintenance:'02 Dec 2026' },
      { id:'m3',name:'Assembly Line A',code:'ASM-A',requiredSkill:'Assembly',minLevel:2,area:'Assembly',status:'idle',assignedWorkerId:'w4',product:'Assembly kit',target:60,unitsMade:0,ratePerHour:7.5,hoursSinceService:0,serviceInterval:60,temperature:58,faultHistory:[],serviceHistory:[],downtimeMinutes:0,downtimeStartedAt:null,downtimeReason:'No operator',serviceWarningSent:false,serviceCriticalSent:false,hotAlertSent:false,longDowntimeAlertSent:false,nextMaintenance:'30 Nov 2026' },
      { id:'m4',name:'Quality Station 02',code:'QAL-02',requiredSkill:'Quality',minLevel:3,area:'Quality',status:'idle',assignedWorkerId:null,product:'Inspected part',target:100,unitsMade:0,ratePerHour:12.5,hoursSinceService:0,serviceInterval:60,temperature:62,faultHistory:[],serviceHistory:[],downtimeMinutes:0,downtimeStartedAt:null,downtimeReason:'No operator',serviceWarningSent:false,serviceCriticalSent:false,hotAlertSent:false,longDowntimeAlertSent:false,nextMaintenance:'05 Dec 2026' },
    ],
    allocations:{Morning:{m1:'w1',m2:'w3',m3:'w4',m4:''},Afternoon:{m1:'w5',m2:'w6',m3:'',m4:''}},
    production:[
      {id:'p1',product:'Precision shaft',machineId:'m1',target:120,unitsMade:0},
      {id:'p2',product:'Welded frame',machineId:'m2',target:80,unitsMade:0},
      {id:'p3',product:'Assembly kit',machineId:'m3',target:60,unitsMade:0},
      {id:'p4',product:'Inspected part',machineId:'m4',target:100,unitsMade:0},
    ],
    simulation:{running:false,elapsedMinutes:0,shiftLengthMinutes:minsPerShift,speed:1,completed:false,paceAlertSent:false,shiftStartedAt:Date.now(),downtimeByReason:{Breakdown:0,'No operator':0,'Material shortage':0,Changeover:0}},
    incidents:[],alerts:[],
  };
}

export function formatClock(shift, elapsedMinutes) {
  const start = shift === 'Afternoon' ? 14*60 : 6*60;
  const total = (start + elapsedMinutes) % (24*60);
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}

function alertOnce(alerts, code, machine, severity, message) {
  const dedupeKey = `${code}:${machine?.id || 'shift'}`;
  if (alerts.some((alert) => alert.dedupeKey === dedupeKey)) return alerts;
  return [{id:`a-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,code,dedupeKey,machineId:machine?.id || null,machineName:machine?.name || null,severity,message,createdAt:new Date().toISOString(),read:false},...alerts];
}

export function advanceSimulation(data) {
  const sim = data.simulation;
  if (!sim.running) return data;
  const step = 5 * sim.speed;
  const delta = Math.min(step, sim.shiftLengthMinutes - sim.elapsedMinutes);
  const elapsed = sim.elapsedMinutes + delta;
  let alerts = [...data.alerts];
  const downtimeByReason = {...sim.downtimeByReason};
  const workers = data.workers.map((worker) => ({...worker}));
  let production = data.production.map((item) => ({...item}));
  const machines = data.machines.map((original) => {
    const machine = {...original,faultHistory:[...original.faultHistory],serviceHistory:[...original.serviceHistory]};
    if (machine.status === 'operating') {
      const variation = 0.95 + Math.random()*0.1;
      const made = Math.max(0,Math.round(machine.ratePerHour*(delta/60)*variation));
      machine.unitsMade += made;
      production = production.map((item) => item.machineId === machine.id ? {...item,unitsMade:machine.unitsMade} : item);
      machine.hoursSinceService += (delta/60)*10;
      machine.temperature = Math.round((machine.temperature + (delta/60)*10*0.35)*10)/10;
      const worker = workers.find((item) => item.id === machine.assignedWorkerId);
      if (worker) worker.runningMinutes += delta;
    } else if (machine.status === 'fault' || machine.status === 'idle' || machine.status === 'maintenanceScheduled') {
      machine.downtimeMinutes += delta;
      const reason = machine.status === 'fault' || machine.status === 'maintenanceScheduled' ? 'Breakdown' : (machine.downtimeReason || (machine.assignedWorkerId ? 'Changeover' : 'No operator'));
      downtimeByReason[reason] = (downtimeByReason[reason] || 0) + delta;
    }

    if (machine.hoursSinceService >= machine.serviceInterval*0.85 && machine.hoursSinceService < machine.serviceInterval && !machine.serviceWarningSent) {
      machine.serviceWarningSent = true; machine.maintenanceState = 'dueSoon';
      alerts = alertOnce(alerts,'upcomingMaintenance',machine,'warning',`${machine.name} service due soon`);
    }
    if (machine.hoursSinceService >= machine.serviceInterval && !machine.serviceCriticalSent) {
      machine.serviceCriticalSent = true; machine.maintenanceState = 'overdue';
      alerts = alertOnce(alerts,'overdueMaintenance',machine,'critical',`${machine.name} service overdue`);
    }
    if (machine.temperature >= 82 && !machine.hotAlertSent) {
      machine.hotAlertSent = true;
      alerts = alertOnce(alerts,'runningHot',machine,'risk',`${machine.name} running hot`);
    }
    const recentFaults = machine.faultHistory.filter((fault) => Date.now()-new Date(fault.timestamp).getTime() <= 30*86400000);
    machine.chronic = recentFaults.length >= 3;
    if ((machine.status === 'fault' || machine.status === 'maintenanceScheduled') && machine.downtimeStartedAt != null && elapsed-machine.downtimeStartedAt > 20 && !machine.longDowntimeAlertSent) {
      machine.longDowntimeAlertSent = true;
      alerts = alertOnce(alerts,'excessiveDowntime',machine,'critical',`Long downtime: ${machine.name}`);
    }
    return machine;
  });

  const target = production.reduce((sum,item)=>sum+item.target,0);
  const actual = production.reduce((sum,item)=>sum+item.unitsMade,0);
  const expected = target*(elapsed/sim.shiftLengthMinutes);
  const paceAlertSent = sim.paceAlertSent || (expected > 0 && actual < expected*0.9);
  if (!sim.paceAlertSent && paceAlertSent) alerts = alertOnce(alerts,'productionBelow',null,'warning','Production below target pace');
  if (machines.some((machine) => machine.status === 'idle' && !machine.assignedWorkerId) && sim.running) {
    alerts = alertOnce(alerts,'workerShortage',null,'warning','Worker shortage: one or more machines are unstaffed');
  }
  const completed = elapsed >= sim.shiftLengthMinutes;
  return {...data,workers,machines,production,alerts,simulation:{...sim,running:!completed,elapsedMinutes:elapsed,completed,paceAlertSent,downtimeByReason}};
}

