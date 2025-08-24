import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from  "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAeabmsd61JVvQxohZJ_ON34GbZ0Zik_20",
  authDomain: "mf-schedule-34ca9.firebaseapp.com",
  projectId: "mf-schedule-34ca9",
  storageBucket: "mf-schedule-34ca9.firebasestorage.app",
  messagingSenderId: "607510148870",
  appId: "1:607510148870:web:d2504750aabadecc351087",
  measurementId: "G-FDBY40S3DD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

const auth = getAuth(app);
const db = getFirestore(app);
// setLogLevel('debug');

let userId = null;
let dbRef = null;
let scheduleData = { workers: [], equipment: [], projects: [], schedule: {}, equipmentSchedule: {} };
let currentWeekOffset = 0;
let currentAssignmentContext = {};

// --- DOM ELEMENTS ---
const pageSchedule = document.getElementById('page-schedule');
const pageEquipment = document.getElementById('page-equipment');
const pageManage = document.getElementById('page-manage');
const navSchedule = document.getElementById('nav-schedule');
const navEquipment = document.getElementById('nav-equipment');
const navManage = document.getElementById('nav-manage');

const scheduleBoard = document.getElementById('schedule-board');
const equipmentScheduleBoard = document.getElementById('equipment-schedule-board');
const userIdDisplay = document.getElementById('userIdDisplay');

const weekRangeEl = document.getElementById('week-range');
const prevWeekBtn = document.getElementById('prevWeekBtn');
const nextWeekBtn = document.getElementById('nextWeekBtn');

const weekRangeEqEl = document.getElementById('week-range-eq');
const prevWeekBtnEq = document.getElementById('prevWeekBtnEq');
const nextWeekBtnEq = document.getElementById('nextWeekBtnEq');

// Modals
const assignWorkerModal = document.getElementById('assignWorkerModal');
const closeAssignModalBtn = document.getElementById('closeAssignModalBtn');
const modalProjectName = document.getElementById('modalProjectName');
const modalWorkerList = document.getElementById('modal-worker-list');

const addProjectModal = document.getElementById('addProjectModal');
const closeAddProjectModalBtn = document.getElementById('closeAddProjectModalBtn');
const modalProjectList = document.getElementById('modal-project-list');

const equipmentNoteModal = document.getElementById('equipmentNoteModal');
const modalEquipmentName = document.getElementById('modalEquipmentName');
const equipmentNoteInput = document.getElementById('equipmentNoteInput');
const saveEquipmentNoteBtn = document.getElementById('saveEquipmentNoteBtn');
const closeEquipmentNoteModalBtn = document.getElementById('closeEquipmentNoteModalBtn');


// --- AUTHENTICATION ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    userId = user.uid;
    userIdDisplay.textContent = `User ID: ${userId}`;
    dbRef = doc(db, "artifacts", appId, "users", userId, "schedule", "board");
    initializeGlobalEventListeners();
    initializeSnapshotListener();
  } else {
    try {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    } catch (error) {
      console.error("Authentication failed:", error);
    }
  }
});

// --- PAGE NAVIGATION ---
function switchPage(page) {
  pageSchedule.classList.add('hidden');
  pageEquipment.classList.add('hidden');
  pageManage.classList.add('hidden');
  navSchedule.classList.remove('active');
  navEquipment.classList.remove('active');
  navManage.classList.remove('active');

  if (page === 'schedule') {
    pageSchedule.classList.remove('hidden');
    navSchedule.classList.add('active');
  } else if (page === 'equipment') {
    pageEquipment.classList.remove('hidden');
    navEquipment.classList.add('active');
  } else if (page === 'manage') {
    pageManage.classList.remove('hidden');
    navManage.classList.add('active');
  }
  renderAll();
}

// --- DATE UTILITIES ---
function getWeekDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekDates(offset = 0) {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  now.setDate(now.getDate() + diff);
  const dates = [];
  for (let i = 0; i < 6; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
}

// --- DATA HANDLING (FIRESTORE) ---
function initializeSnapshotListener() {
  switchPage('schedule');
  onSnapshot(dbRef, (docSnap) => {
    const defaultData = { workers: [], equipment: [], projects: [], schedule: {}, equipmentSchedule: {} };
    if (docSnap.exists()) {
      scheduleData = { ...defaultData, ...docSnap.data() };
    } else {
      scheduleData = defaultData;
      setDoc(dbRef, scheduleData).catch(err => console.error("Failed to create initial doc:", err));
    }
    renderAll();
  }, (error) => console.error("Snapshot listener error:", error));
}

// --- RENDER FUNCTIONS ---
function renderAll() {
  renderWeek();
  if (pageManage.offsetParent !== null) {
    renderManageProjects();
    renderManageWorkers();
  }
  if (pageEquipment.offsetParent !== null) {
    renderAvailableEquipment();
  }
}

function renderWeek() {
  const dates = getWeekDates(currentWeekOffset);
  scheduleBoard.innerHTML = '';
  equipmentScheduleBoard.innerHTML = '';

  const startOfWeek = dates[0];
  const endOfWeek = dates[dates.length - 1];
  const weekString = `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
  weekRangeEl.textContent = weekString;
  weekRangeEqEl.textContent = weekString;

  dates.forEach(date => {
    const dayKey = getWeekDateKey(date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const scheduleDayCol = document.createElement('div');
    scheduleDayCol.className = 'bg-white rounded-xl shadow-md p-4 flex flex-col';
    scheduleDayCol.innerHTML = `
                    <div>
                        <h3 class="text-lg font-semibold mb-1">${dayName}</h3>
                        <p class="text-sm text-gray-500 mb-4">${dayDate}</p>
                    </div>
                    <div id="day-projects-${dayKey}" data-day-key="${dayKey}" data-type="project" class="day-column space-y-3 flex-grow"></div>
                    <button class="add-project-to-day-btn mt-4 bg-purple-500 text-white text-sm font-semibold w-full py-1.5 rounded hover:bg-purple-600" data-day-key="${dayKey}">+ Add Project</button>
                `;
    scheduleBoard.appendChild(scheduleDayCol);

    const scheduledProjects = scheduleData.schedule[dayKey] || [];
    const projectsContainer = scheduleDayCol.querySelector(`#day-projects-${dayKey}`);
    scheduledProjects.forEach(projInstance => {
      projectsContainer.appendChild(createProjectCard(projInstance, dayKey));
    });

    const equipmentDayCol = document.createElement('div');
    equipmentDayCol.className = 'bg-white rounded-xl shadow-md p-4 flex flex-col';
    equipmentDayCol.innerHTML = `
                     <div>
                        <h3 class="text-lg font-semibold mb-1">${dayName}</h3>
                        <p class="text-sm text-gray-500 mb-4">${dayDate}</p>
                    </div>
                    <div id="day-equipment-${dayKey}" data-day-key="${dayKey}" data-type="equipment" class="day-column space-y-3 flex-grow"></div>
                `;
    equipmentScheduleBoard.appendChild(equipmentDayCol);

    const scheduledEquipment = scheduleData.equipmentSchedule[dayKey] || [];
    const equipmentContainer = equipmentDayCol.querySelector(`#day-equipment-${dayKey}`);
    scheduledEquipment.forEach(eq => {
      equipmentContainer.appendChild(createEquipmentCard(eq, dayKey));
    });
  });
  initializeEquipmentPageSortable();
}

function renderManageProjects() {
  const container = document.getElementById('manage-project-list');
  if (!container) return;
  container.innerHTML = '';
  const projects = scheduleData.projects || [];
  if (projects.length === 0) {
    container.innerHTML = `<p class="text-gray-500 text-center p-4">No projects added.</p>`;
  } else {
    projects.forEach(item => container.appendChild(createManageListItem(item, 'project')));
  }
}

function renderManageWorkers() {
  const container = document.getElementById('manage-worker-list');
  if (!container) return;
  container.innerHTML = '';
  const workers = scheduleData.workers || [];

  if (workers.length === 0) {
    container.innerHTML = `<p class="text-gray-500 text-center p-4">No workers added.</p>`;
    return;
  }
  const weekDates = getWeekDates(currentWeekOffset).map(getWeekDateKey);
  workers.forEach(worker => {
    const weeklyAssignments = weekDates.map(dayKey => {
      const daySchedule = scheduleData.schedule[dayKey] || [];
      return daySchedule.some(project =>
        project.leadWorker === worker.id || (project.team && project.team.includes(worker.id))
      );
    });
    container.appendChild(createManageListItem(worker, 'worker', weeklyAssignments));
  });
}

function renderAvailableEquipment() {
  const container = document.getElementById('available-equipment');
  if (!container) return;
  container.innerHTML = '';
  const equipment = scheduleData.equipment || [];

  if (equipment.length === 0) {
    container.innerHTML = `<p class="text-gray-500 text-center p-4">No equipment available.</p>`;
  } else {
    equipment.forEach(item => container.appendChild(createDraggableListItem(item, 'equipment')));
  }
  initializeEquipmentPageSortable();
}

function createManageListItem(item, type, weeklyAssignments = []) {
  const el = document.createElement('div');
  el.className = 'bg-white p-3 rounded-lg shadow-sm';

  let contentHTML = `<div class="flex items-center justify-between"><span class="font-medium">${item.name}</span>`;

  if (type === 'worker') {
    const indicatorSpans = weeklyAssignments.map((isAssigned, index) => {
      const day = getWeekDates(currentWeekOffset)[index].toLocaleDateString('en-US', { weekday: 'short' });
      return `<span class="w-2.5 h-2.5 rounded-full ${isAssigned ? 'bg-green-500' : 'bg-gray-300'}" title="${day}: ${isAssigned ? 'Assigned' : 'Available'}"></span>`;
    }).join('');

    contentHTML += `<div class="flex gap-1.5 items-center" title="Weekly assignments (Mon-Sat)">${indicatorSpans}</div>`;
  }

  contentHTML += `<button data-id="${item.id}" data-type="${type}" class="delete-btn text-gray-400 hover:text-red-500 transition-colors"><i class="ph-trash text-lg"></i></button></div>`;

  if (type === 'project') {
    const isActive = item.status === 'active';
    const projectType = item.type || 'field';
    let typeButtonClass = '';
    switch(projectType) {
      case 'yard': typeButtonClass = 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300'; break;
      case 'field': typeButtonClass = 'bg-green-200 text-green-800 hover:bg-green-300'; break;
      case 'out-of-town': typeButtonClass = 'bg-orange-200 text-orange-800 hover:bg-orange-300'; break;
    }

    contentHTML += `
                    <div class="mt-2 pt-2 border-t flex items-center justify-between">
                        <div class="flex items-center gap-3">
                           <span class="text-sm font-medium">Status:</span>
                            <button data-id="${item.id}" class="toggle-status-btn text-xs font-semibold py-1 px-3 rounded-full ${isActive ? 'bg-green-200 text-green-800 hover:bg-green-300' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}">
                                ${isActive ? 'Active' : 'Inactive'}
                            </button>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-sm font-medium">Type:</span>
                            <button data-id="${item.id}" class="toggle-type-btn text-xs font-semibold py-1 px-3 rounded-full capitalize ${typeButtonClass}">
                                ${projectType.replace('-', ' ')}
                            </button>
                        </div>
                    </div>
                `;
  }

  el.innerHTML = contentHTML;
  return el;
}

function createDraggableListItem(item, type) {
  const el = document.createElement('div');
  el.className = `item-card bg-green-100 p-3 rounded-lg shadow-sm flex items-center justify-between`;
  el.setAttribute(`data-${type}-id`, item.id);
  el.setAttribute(`data-${type}-name`, item.name);
  el.setAttribute('data-type', type);
  el.innerHTML = `<span class="font-medium">${item.name}</span>`;
  return el;
}

function getProjectColorClasses(projectType) {
  switch(projectType) {
    case 'yard': return 'bg-yellow-200';
    case 'field': return 'bg-green-200';
    case 'out-of-town': return 'bg-orange-200';
    default: return 'bg-purple-200';
  }
}

function createProjectCard(projectInstance, dayKey) {
  const project = scheduleData.projects.find(p => p.id === projectInstance.projectId) || {};
  const card = document.createElement('div');
  card.className = `item-card p-3 rounded-lg shadow ${getProjectColorClasses(project.type)}`;
  card.setAttribute('data-instance-id', projectInstance.instanceId);
  card.setAttribute('data-project-id', projectInstance.projectId);
  card.setAttribute('data-day-key', dayKey);

  const leadWorkerId = projectInstance.leadWorker;
  const leadWorker = scheduleData.workers.find(w => w.id === leadWorkerId);
  const leadWorkerTag = leadWorker ? createWorkerTag(leadWorker, 'lead') : '';

  const teamWorkerTags = (projectInstance.team || []).map(workerId => {
    const worker = scheduleData.workers.find(w => w.id === workerId);
    return worker ? createWorkerTag(worker, 'team') : '';
  }).join('');

  card.innerHTML = `
                <div class="font-bold text-gray-800 mb-2 flex justify-between items-center">
                    <span>${projectInstance.projectName}</span>
                    <button class="delete-project-instance text-gray-500 hover:text-red-600">&times;</button>
                </div>
                <div class="text-xs text-gray-700 mb-1 font-semibold">Lead:</div>
                <div class="p-2 bg-white/50 rounded min-h-[2.5rem]">${leadWorkerTag}</div>
                <div class="text-xs text-gray-700 mt-2 mb-1 font-semibold">Team:</div>
                <div class="p-2 bg-white/50 rounded min-h-[2.5rem] flex flex-wrap gap-1">${teamWorkerTags}</div>
                <button class="assign-workers-btn mt-3 bg-indigo-500 text-white text-sm font-semibold w-full py-1.5 rounded hover:bg-indigo-600">Assign Workers</button>
            `;
  return card;
}

function createWorkerTag(worker, role) {
  return `<span class="worker-tag bg-indigo-500 text-white text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1">
                ${worker.name}
                <button class="delete-worker text-indigo-200 hover:text-white" data-worker-id="${worker.id}" data-role="${role}">&times;</button>
            </span>`;
}

function createEquipmentCard(equipment, dayKey) {
  const card = document.createElement('div');
  card.className = 'item-card bg-green-200 p-3 rounded-lg shadow';
  card.setAttribute('data-instance-id', equipment.instanceId);
  card.setAttribute('data-day-key', dayKey);
  card.innerHTML = `
                <div class="font-bold text-green-800 flex justify-between items-center">
                   <span>${equipment.equipmentName}</span>
                   <button class="delete-scheduled-equipment text-green-600 hover:text-red-600">&times;</button>
                </div>
                <p class="text-sm text-green-700 mt-1">${equipment.note || ''}</p>
            `;
  return card;
}

// --- SORTABLEJS & DRAG/DROP LOGIC ---
function initializeEquipmentPageSortable() {
  const aec = document.getElementById('available-equipment');
  if(aec) new Sortable(aec, { group: { name: 'equipment', pull: 'clone', put: false }, sort: false });
  document.querySelectorAll('[id^="day-equipment-"]').forEach(col => new Sortable(col, { group: 'equipment', animation: 150, onAdd: handleEquipmentDropOnDay }));
}

async function handleEquipmentDropOnDay(evt) {
  const { item, to } = evt;
  const dayKey = to.dataset.dayKey;
  const equipmentId = item.dataset.equipmentId;
  const equipmentName = item.dataset.equipmentName;

  if (dayKey && equipmentId) {
    openEquipmentNoteModal({ id: equipmentId, name: equipmentName }, dayKey);
  }
  item.remove();
}

// --- ADD & DELETE LOGIC ---
async function addItem(type, name) {
  if (!name || !userId) return;
  let newItem;
  if (type === 'project') {
    newItem = { id: crypto.randomUUID(), name: name, status: 'active', type: 'field' };
  } else {
    newItem = { id: crypto.randomUUID(), name: name };
  }
  const key = type === 'equipment' ? 'equipment' : `${type}s`;
  await updateDoc(dbRef, { [key]: arrayUnion(newItem) });

  if (type === 'project') document.getElementById('projectNameInput').value = '';
  else if (type === 'worker') document.getElementById('workerNameInput').value = '';
  else if (type === 'equipment') document.getElementById('equipmentNameInput').value = '';
}

async function deleteItem(type, id) {
  const key = type === 'equipment' ? 'equipment' : `${type}s`;
  const itemArray = scheduleData[key];
  const itemToDelete = itemArray.find(i => i.id === id);
  if (!itemToDelete) return;

  const customModal = document.createElement('div');
  customModal.innerHTML = `<div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;"><div style="background: white; padding: 2rem; border-radius: 0.5rem; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.1);"><p class="mb-4">Are you sure you want to delete this ${type}: "${itemToDelete.name}"?<br>This will remove it from all schedules.</p><div class="flex justify-center gap-4"><button id="confirmDelete" class="bg-red-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-red-700">Yes, delete</button><button id="cancelDelete" class="bg-gray-300 text-gray-800 font-semibold py-2 px-5 rounded-lg hover:bg-gray-400">Cancel</button></div></div></div>`;
  document.body.appendChild(customModal);

  document.getElementById('confirmDelete').onclick = async () => {
    const updates = { [key]: arrayRemove(itemToDelete) };

    if (type === 'worker' || type === 'project') {
      const newSchedule = JSON.parse(JSON.stringify(scheduleData.schedule));
      Object.keys(newSchedule).forEach(dayKey => {
        let dayArray = newSchedule[dayKey];
        if (type === 'project') {
          newSchedule[dayKey] = dayArray.filter(p => p.projectId !== id);
        } else if (type === 'worker') {
          dayArray.forEach(p => {
            if (p.leadWorker === id) p.leadWorker = null;
            if (p.team) p.team = p.team.filter(wId => wId !== id);
          });
        }
      });
      updates.schedule = newSchedule;
    } else if (type === 'equipment') {
      const newEqSchedule = JSON.parse(JSON.stringify(scheduleData.equipmentSchedule));
      Object.keys(newEqSchedule).forEach(dayKey => {
        newEqSchedule[dayKey] = newEqSchedule[dayKey].filter(e => e.equipmentId !== id);
      });
      updates.equipmentSchedule = newEqSchedule;
    }
    await setDoc(dbRef, updates, { merge: true });
    document.body.removeChild(customModal);
  };
  document.getElementById('cancelDelete').onclick = () => document.body.removeChild(customModal);
}

async function deleteProjectInstance(instanceId, dayKey) {
  const daySchedule = scheduleData.schedule[dayKey] || [];
  const instanceToRemove = daySchedule.find(p => p.instanceId === instanceId);
  if (instanceToRemove) {
    await updateDoc(dbRef, { [`schedule.${dayKey}`]: arrayRemove(instanceToRemove) });
  }
}

async function deleteAssignedWorker(instanceId, dayKey, workerId, role) {
  const daySchedule = scheduleData.schedule[dayKey] || [];
  const projectIndex = daySchedule.findIndex(p => p.instanceId === instanceId);
  if (projectIndex === -1) return;

  const projectInstance = { ...daySchedule[projectIndex] };
  if (role === 'lead' && projectInstance.leadWorker === workerId) {
    projectInstance.leadWorker = null;
  } else {
    projectInstance.team = (projectInstance.team || []).filter(id => id !== workerId);
  }

  const newDaySchedule = [...daySchedule];
  newDaySchedule[projectIndex] = projectInstance;
  await updateDoc(dbRef, { [`schedule.${dayKey}`]: newDaySchedule });
}

async function deleteAssignedEquipment(instanceId, dayKey) {
  const daySchedule = scheduleData.equipmentSchedule[dayKey] || [];
  const equipmentToRemove = daySchedule.find(e => e.instanceId === instanceId);
  if(equipmentToRemove) {
    await updateDoc(dbRef, { [`equipmentSchedule.${dayKey}`]: arrayRemove(equipmentToRemove) });
  }
}

// --- MODAL LOGIC ---
function openAssignWorkerModal(instanceId, dayKey) {
  currentAssignmentContext = { instanceId, dayKey };
  const projectInstance = (scheduleData.schedule[dayKey] || []).find(p => p.instanceId === instanceId);
  if (!projectInstance) return;

  modalProjectName.textContent = projectInstance.projectName;
  modalWorkerList.innerHTML = '';

  const allWorkers = scheduleData.workers || [];
  allWorkers.forEach(worker => {
    const isLead = projectInstance.leadWorker === worker.id;
    const isTeamMember = (projectInstance.team || []).includes(worker.id);

    const li = document.createElement('div');
    li.className = 'flex items-center justify-between p-2 bg-gray-100 rounded';
    li.innerHTML = `
                    <span>${worker.name}</span>
                    <div class="flex gap-2">
                        <button class="assign-role-btn text-xs font-semibold py-1 px-2 rounded ${isLead ? 'bg-yellow-400' : 'bg-gray-300 hover:bg-yellow-300'}" data-worker-id="${worker.id}" data-role="lead" ${isTeamMember ? 'disabled' : ''}>
                            ${isLead ? 'Lead' : 'Make Lead'}
                        </button>
                        <button class="assign-role-btn text-xs font-semibold py-1 px-2 rounded ${isTeamMember ? 'bg-blue-400 text-white' : 'bg-gray-300 hover:bg-blue-300'}" data-worker-id="${worker.id}" data-role="team" ${isLead ? 'disabled' : ''}>
                            ${isTeamMember ? 'Team' : 'Add to Team'}
                        </button>
                    </div>
                `;
    modalWorkerList.appendChild(li);
  });

  assignWorkerModal.classList.remove('hidden');
}

function openAddProjectModal(dayKey) {
  currentAssignmentContext = { dayKey };
  modalProjectList.innerHTML = '';
  const allProjects = (scheduleData.projects || []).filter(p => p.status === 'active');

  if (allProjects.length === 0) {
    modalProjectList.innerHTML = `<p class="text-center text-gray-500">No active projects available. Add or activate projects on the "Manage" page.</p>`;
  } else {
    allProjects.forEach(project => {
      const li = document.createElement('div');
      li.className = 'flex items-center justify-between p-2 bg-gray-100 rounded';
      li.innerHTML = `
                        <span>${project.name}</span>
                        <button class="add-project-from-modal-btn bg-purple-500 text-white text-xs font-semibold py-1 px-3 rounded hover:bg-purple-600" data-project-id="${project.id}" data-project-name="${project.name}">Add</button>
                    `;
      modalProjectList.appendChild(li);
    });
  }
  addProjectModal.classList.remove('hidden');
}

function openEquipmentNoteModal(equipment, dayKey) {
  currentAssignmentContext = { equipment, dayKey };
  modalEquipmentName.textContent = equipment.name;
  equipmentNoteInput.value = '';
  equipmentNoteModal.classList.remove('hidden');
  equipmentNoteInput.focus();
}

async function handleAddProjectFromModal(e) {
  if (!e.target.matches('.add-project-from-modal-btn')) return;
  const { projectId, projectName } = e.target.dataset;
  const { dayKey } = currentAssignmentContext;

  const newInstance = {
    instanceId: crypto.randomUUID(),
    projectId,
    projectName,
    leadWorker: null,
    team: []
  };
  await updateDoc(dbRef, { [`schedule.${dayKey}`]: arrayUnion(newInstance) });
  addProjectModal.classList.add('hidden');
}

async function handleRoleAssign(e) {
  if (!e.target.matches('.assign-role-btn')) return;
  const { workerId, role } = e.target.dataset;
  const { instanceId, dayKey } = currentAssignmentContext;

  const daySchedule = scheduleData.schedule[dayKey] || [];
  const projectIndex = daySchedule.findIndex(p => p.instanceId === instanceId);
  if (projectIndex === -1) return;

  const projectInstance = { ...daySchedule[projectIndex] };
  const isLead = projectInstance.leadWorker === workerId;
  const isTeamMember = (projectInstance.team || []).includes(workerId);

  if (role === 'lead') {
    projectInstance.leadWorker = isLead ? null : workerId;
  } else if (role === 'team') {
    if (isTeamMember) {
      projectInstance.team = projectInstance.team.filter(id => id !== workerId);
    } else {
      if (!projectInstance.team) projectInstance.team = [];
      projectInstance.team.push(workerId);
    }
  }

  const newDaySchedule = [...daySchedule];
  newDaySchedule[projectIndex] = projectInstance;
  await updateDoc(dbRef, { [`schedule.${dayKey}`]: newDaySchedule });
  openAssignWorkerModal(instanceId, dayKey);
}

async function handleStatusToggle(projectId) {
  const projects = scheduleData.projects || [];
  const projectIndex = projects.findIndex(p => p.id === projectId);
  if (projectIndex === -1) return;

  const updatedProjects = [...projects];
  const currentStatus = updatedProjects[projectIndex].status;
  updatedProjects[projectIndex].status = currentStatus === 'active' ? 'inactive' : 'active';

  await updateDoc(dbRef, { projects: updatedProjects });
}

async function handleTypeToggle(projectId) {
  const projects = scheduleData.projects || [];
  const projectIndex = projects.findIndex(p => p.id === projectId);
  if (projectIndex === -1) return;

  const updatedProjects = [...projects];
  const currentType = updatedProjects[projectIndex].type || 'field';

  const types = ['field', 'yard', 'out-of-town'];
  const currentIndex = types.indexOf(currentType);
  const nextIndex = (currentIndex + 1) % types.length;

  updatedProjects[projectIndex].type = types[nextIndex];

  await updateDoc(dbRef, { projects: updatedProjects });
}

function generatePrintableHTML() {
  const printableContainer = document.getElementById('printable-schedule');
  const dates = getWeekDates(currentWeekOffset);
  let html = `<h1 style="text-align: center; font-size: 2em; margin-bottom: 20px;">Weekly Schedule: ${dates[0].toLocaleDateString()} - ${dates[dates.length-1].toLocaleDateString()}</h1>`;

  dates.forEach(date => {
    const dayKey = getWeekDateKey(date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const scheduledProjects = scheduleData.schedule[dayKey] || [];

    html += `<div style="margin-bottom: 20px; page-break-inside: avoid;">`;
    html += `<h2 style="font-size: 1.5em; border-bottom: 2px solid #ccc; padding-bottom: 5px; margin-bottom: 10px;">${dayName}, ${dayDate}</h2>`;

    if (scheduledProjects.length === 0) {
      html += `<p>No projects scheduled.</p>`;
    } else {
      scheduledProjects.forEach(project => {
        const leadWorker = scheduleData.workers.find(w => w.id === project.leadWorker);
        const teamWorkers = (project.team || []).map(id => scheduleData.workers.find(w => w.id === id)?.name).filter(Boolean).join(', ');

        html += `<div style="margin-bottom: 15px; border: 1px solid #eee; padding: 10px;">`;
        html += `<h3 style="font-size: 1.2em; font-weight: bold;">${project.projectName}</h3>`;
        html += `<p><strong>Lead:</strong> ${leadWorker ? leadWorker.name : 'N/A'}</p>`;
        html += `<p><strong>Team:</strong> ${teamWorkers || 'N/A'}</p>`;
        html += `</div>`;
      });
    }
    html += `</div>`;
  });
  printableContainer.innerHTML = html;
}

// --- EVENT LISTENERS ---
function initializeGlobalEventListeners() {
  navSchedule.addEventListener('click', () => switchPage('schedule'));
  navEquipment.addEventListener('click', () => switchPage('equipment'));
  navManage.addEventListener('click', () => switchPage('manage'));

  document.getElementById('publishBtn').addEventListener('click', () => {
    generatePrintableHTML();
    window.print();
  });

  document.body.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    if (target.matches('.delete-btn')) {
      deleteItem(target.dataset.type, target.dataset.id);
    } else if (target.matches('.delete-project-instance')) {
      const card = target.closest('.item-card');
      deleteProjectInstance(card.dataset.instanceId, card.dataset.dayKey);
    } else if (target.matches('.delete-worker')) {
      const card = target.closest('.item-card');
      deleteAssignedWorker(card.dataset.instanceId, card.dataset.dayKey, target.dataset.workerId, target.dataset.role);
    } else if (target.matches('.delete-scheduled-equipment')) {
      const card = target.closest('.item-card');
      deleteAssignedEquipment(card.dataset.instanceId, card.dataset.dayKey);
    } else if (target.matches('.assign-workers-btn')) {
      const card = target.closest('.item-card');
      openAssignWorkerModal(card.dataset.instanceId, card.dataset.dayKey);
    } else if (target.matches('.add-project-to-day-btn')) {
      openAddProjectModal(target.dataset.dayKey);
    } else if (target.matches('.toggle-status-btn')) {
      handleStatusToggle(target.dataset.id);
    } else if (target.matches('.toggle-type-btn')) {
      handleTypeToggle(target.dataset.id);
    }
  });

  modalWorkerList.addEventListener('click', handleRoleAssign);
  closeAssignModalBtn.addEventListener('click', () => assignWorkerModal.classList.add('hidden'));
  modalProjectList.addEventListener('click', handleAddProjectFromModal);
  closeAddProjectModalBtn.addEventListener('click', () => addProjectModal.classList.add('hidden'));

  saveEquipmentNoteBtn.addEventListener('click', async () => {
    const { equipment, dayKey } = currentAssignmentContext;
    const note = equipmentNoteInput.value.trim();
    const newInstance = {
      instanceId: crypto.randomUUID(),
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      note: note
    };
    await updateDoc(dbRef, { [`equipmentSchedule.${dayKey}`]: arrayUnion(newInstance) });
    equipmentNoteModal.classList.add('hidden');
  });
  closeEquipmentNoteModalBtn.addEventListener('click', () => equipmentNoteModal.classList.add('hidden'));


  function handleWeekNav(offset) {
    currentWeekOffset += offset;
    renderAll();
  }

  prevWeekBtn.addEventListener('click', () => handleWeekNav(-1));
  nextWeekBtn.addEventListener('click', () => handleWeekNav(1));
  prevWeekBtnEq.addEventListener('click', () => handleWeekNav(-1));
  nextWeekBtnEq.addEventListener('click', () => handleWeekNav(1));

  pageManage.addEventListener('click', (e) => {
    const target = e.target;
    if (target.matches('#addProjectBtn')) {
      const input = document.getElementById('projectNameInput');
      if(input) addItem('project', input.value.trim());
    } else if (target.matches('#addWorkerBtn')) {
      const input = document.getElementById('workerNameInput');
      if(input) addItem('worker', input.value.trim());
    }
  });
  pageManage.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (e.target.matches('#projectNameInput')) {
        addItem('project', e.target.value.trim());
      } else if (e.target.matches('#workerNameInput')) {
        addItem('worker', e.target.value.trim());
      }
    }
  });
  pageEquipment.addEventListener('click', (e) => {
    if (e.target.matches('#addEquipmentBtn')) {
      const input = document.getElementById('equipmentNameInput');
      if(input) addItem('equipment', input.value.trim());
    }
  });
  pageEquipment.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.matches('#equipmentNameInput')) {
      addItem('equipment', e.target.value.trim());
    }
  });
}
