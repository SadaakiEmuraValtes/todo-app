const STORAGE_KEY = 'todo-app-v1';
let todos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let filter = 'all';
let dragSrcIndex = null;

const listEl         = document.getElementById('todo-list');
const inputEl        = document.getElementById('new-todo');
const dueEl          = document.getElementById('new-due');
const addBtn         = document.getElementById('add-btn');
const remaining      = document.getElementById('remaining');
const emptyMsg       = document.getElementById('empty-msg');
const clearBtn       = document.getElementById('clear-completed');
const badgeAll       = document.getElementById('badge-all');
const badgeActive    = document.getElementById('badge-active');
const badgeCompleted = document.getElementById('badge-completed');
const progressFill   = document.getElementById('progress-fill');
const progressPct    = document.getElementById('progress-pct');
const modalOverlay   = document.getElementById('modal-overlay');
const modalTaskName  = document.getElementById('modal-task-name');
const toastEl        = document.getElementById('toast');
const toastMsg       = document.getElementById('toast-msg');
let toastTimer       = null;

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function filtered() {
  if (filter === 'active')    return todos.filter(t => !t.done);
  if (filter === 'completed') return todos.filter(t => t.done);
  return todos;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatFullDate(due) {
  const [y, m, d] = due.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function formatRemaining(due) {
  if (!due) return null;
  const now = new Date();
  const dueEnd = new Date(due + 'T23:59:59');
  const diffMs = dueEnd - now;

  if (diffMs < 0) return { text: '期限切れ', cls: 'overdue' };

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const totalDays  = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (totalDays >= 7) {
    const weeks = Math.floor(totalDays / 7);
    return { text: `${weeks}週間`, cls: 'upcoming' };
  } else if (totalDays >= 1) {
    const cls = totalDays <= 2 ? 'warn' : 'upcoming';
    return { text: `${totalDays}日`, cls };
  } else if (totalHours >= 1) {
    return { text: `${totalHours}時間`, cls: 'today' };
  } else {
    return { text: 'まもなく', cls: 'today' };
  }
}

function render() {
  const visible = filtered();
  listEl.innerHTML = '';

  visible.forEach((todo) => {
    const realIndex = todos.indexOf(todo);
    const today = todayStr();
    const isOverdue = todo.due && !todo.done && todo.due < today;

    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.done ? ' done' : '') + (isOverdue ? ' overdue' : '');
    li.draggable = true;
    li.dataset.index = realIndex;

    const check = document.createElement('div');
    check.className = 'todo-check';
    check.addEventListener('click', () => toggle(realIndex));

    const textWrap = document.createElement('div');
    textWrap.className = 'todo-text-wrap';

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;

    // Double-click to edit
    text.addEventListener('dblclick', () => {
      text.contentEditable = 'true';
      text.focus();
      const range = document.createRange();
      range.selectNodeContents(text);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    });

    text.addEventListener('blur', () => {
      text.contentEditable = 'false';
      const newText = text.textContent.trim();
      if (newText) {
        todos[realIndex].text = newText;
      } else {
        todos.splice(realIndex, 1);
      }
      save();
      render();
    });

    text.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); text.blur(); }
      if (e.key === 'Escape') {
        text.textContent = todos[realIndex].text;
        text.blur();
      }
    });

    textWrap.appendChild(text);

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '✕';
    del.title = '削除';
    del.addEventListener('click', () => {
      todos.splice(realIndex, 1);
      save(); render();
    });

    li.appendChild(check);
    li.appendChild(textWrap);

    // Due tag (right side)
    if (todo.due && !todo.done) {
      const rem = formatRemaining(todo.due);

      const dueTag = document.createElement('div');
      dueTag.className = 'due-tag';

      const remSpan = document.createElement('span');
      remSpan.className = `due-remaining ${rem.cls}`;
      remSpan.textContent = rem.text;

      // Calendar icon picker
      const duePicker = document.createElement('input');
      duePicker.type = 'date';
      duePicker.className = 'due-picker';
      duePicker.value = todo.due;
      duePicker.addEventListener('change', () => {
        todos[realIndex].due = duePicker.value || null;
        save(); render();
      });

      // Floating tooltip: full date
      const tooltip = document.createElement('div');
      tooltip.className = 'due-tooltip';
      tooltip.textContent = formatFullDate(todo.due);

      dueTag.appendChild(remSpan);
      dueTag.appendChild(duePicker);
      dueTag.appendChild(tooltip);
      li.appendChild(dueTag);
    } else if (todo.due && todo.done) {
      // Completed: just show picker icon to allow date removal
      const dueTag = document.createElement('div');
      dueTag.className = 'due-tag done-tag';
      const duePicker = document.createElement('input');
      duePicker.type = 'date';
      duePicker.className = 'due-picker';
      duePicker.value = todo.due;
      duePicker.addEventListener('change', () => {
        todos[realIndex].due = duePicker.value || null;
        save(); render();
      });
      dueTag.appendChild(duePicker);
      li.appendChild(dueTag);
    }

    li.appendChild(del);

    // Drag events
    li.addEventListener('dragstart', () => {
      dragSrcIndex = realIndex;
      setTimeout(() => li.classList.add('dragging'), 0);
    });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));
    li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('drag-over'); });
    li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      li.classList.remove('drag-over');
      const targetIndex = parseInt(li.dataset.index);
      if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;
      const [moved] = todos.splice(dragSrcIndex, 1);
      todos.splice(targetIndex, 0, moved);
      dragSrcIndex = null;
      save(); render();
    });

    listEl.appendChild(li);
  });

  const totalCount    = todos.length;
  const activeCount   = todos.filter(t => !t.done).length;
  const doneCount     = todos.filter(t => t.done).length;
  const pct           = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  remaining.textContent     = `${activeCount}件 残り`;
  badgeAll.textContent       = totalCount;
  badgeActive.textContent    = activeCount;
  badgeCompleted.textContent = doneCount;
  progressFill.style.width   = pct + '%';
  progressPct.textContent    = pct + '%';
  emptyMsg.style.display     = visible.length === 0 ? 'block' : 'none';
}

function showToast(msg) {
  toastMsg.textContent = msg;
  toastEl.classList.add('visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 2500);
}

async function addTodo() {
  const text = inputEl.value.trim();
  if (!text) return;

  // Show loading modal
  modalTaskName.textContent = `「${text}」`;
  modalOverlay.classList.add('visible');
  inputEl.value = '';

  // Simulate 2–3 second processing
  const delay = 2000 + Math.random() * 1000;
  await new Promise(resolve => setTimeout(resolve, delay));

  // Actually add the todo
  const due = dueEl.value || null;
  dueEl.value = '';
  todos.unshift({ id: Date.now(), text, due, done: false });
  save();
  render();

  // Hide modal
  modalOverlay.classList.remove('visible');

  // Show success toast
  showToast(`「${text}」を追加しました`);
}

function toggle(index) {
  todos[index].done = !todos[index].done;
  save(); render();
}

addBtn.addEventListener('click', addTodo);
inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });

clearBtn.addEventListener('click', () => {
  todos = todos.filter(t => !t.done);
  save(); render();
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    filter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });
});

render();
