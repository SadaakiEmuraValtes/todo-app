const { createApp, ref, computed, watch } = Vue;

const STORAGE_KEY = 'todo-app-v1';

const app = createApp({
  setup() {
    // State
    const todos       = ref(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
    const filter      = ref('all');
    const sortBy      = ref('default');
    const newTodo     = ref('');
    const newDue      = ref('');
    const showModal   = ref(false);
    const modalTaskText = ref('');
    const toastVisible  = ref(false);
    const toastMessage  = ref('');
    const editingId   = ref(null);
    const editText    = ref('');
    const draggingId  = ref(null);
    const dragOverId  = ref(null);
    let dragSrcId  = null;
    let toastTimer = null;

    // Persist to localStorage
    watch(todos, val => localStorage.setItem(STORAGE_KEY, JSON.stringify(val)), { deep: true });

    // Computed stats
    const totalCount  = computed(() => todos.value.length);
    const activeCount = computed(() => todos.value.filter(t => !t.done).length);
    const doneCount   = computed(() => todos.value.filter(t => t.done).length);
    const pct         = computed(() =>
      totalCount.value === 0 ? 0 : Math.round((doneCount.value / totalCount.value) * 100)
    );

    // Filtered + sorted list
    const filteredTodos = computed(() => {
      let result;
      if (filter.value === 'active')         result = todos.value.filter(t => !t.done);
      else if (filter.value === 'completed') result = todos.value.filter(t => t.done);
      else                                   result = [...todos.value];

      if (sortBy.value === 'due-asc') {
        result.sort((a, b) => (a.due || '9999-99-99').localeCompare(b.due || '9999-99-99'));
      } else if (sortBy.value === 'due-desc') {
        result.sort((a, b) => {
          if (!a.due && !b.due) return 0;
          if (!a.due) return 1;
          if (!b.due) return -1;
          return b.due.localeCompare(a.due);
        });
      }
      return result;
    });

    // Helpers
    function todayStr() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function isOverdue(todo) {
      return todo.due && !todo.done && todo.due < todayStr();
    }

    function formatFullDate(due) {
      const [y, m, d] = due.split('-');
      return `${y}年${parseInt(m)}月${parseInt(d)}日`;
    }

    function formatRemaining(due) {
      if (!due) return { text: '', cls: '' };
      const diffMs     = new Date(due + 'T23:59:59') - new Date();
      if (diffMs < 0)  return { text: '期限切れ', cls: 'overdue' };
      const totalHours = Math.floor(diffMs / 3600000);
      const totalDays  = Math.floor(diffMs / 86400000);
      if (totalDays >= 7) return { text: `${Math.floor(totalDays / 7)}週間`, cls: 'upcoming' };
      if (totalDays >= 1) return { text: `${totalDays}日`, cls: totalDays <= 2 ? 'warn' : 'upcoming' };
      if (totalHours >= 1) return { text: `${totalHours}時間`, cls: 'today' };
      return { text: 'まもなく', cls: 'today' };
    }

    function showToastMsg(msg) {
      toastMessage.value = msg;
      toastVisible.value = true;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastVisible.value = false; }, 2500);
    }

    // Actions
    async function addTodo() {
      const text = newTodo.value.trim();
      if (!text) return;
      modalTaskText.value = `「${text}」`;
      showModal.value = true;
      newTodo.value = '';
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
      const due = newDue.value || null;
      newDue.value = '';
      todos.value.unshift({ id: Date.now(), text, due, done: false });
      showModal.value = false;
      showToastMsg(`「${text}」を追加しました`);
    }

    function toggle(todo) {
      todo.done = !todo.done;
    }

    function deleteTodo(todo) {
      const i = todos.value.indexOf(todo);
      if (i !== -1) todos.value.splice(i, 1);
    }

    function clearCompleted() {
      todos.value = todos.value.filter(t => !t.done);
    }

    function updateDue(todo, value) {
      todo.due = value || null;
    }

    // Inline editing
    function startEdit(todo) {
      editText.value  = todo.text;
      editingId.value = todo.id;
    }

    function finishEdit(todo, e) {
      if (editingId.value !== todo.id) return;
      const newText = e.target.value.trim();
      editingId.value = null;
      if (newText) {
        todo.text = newText;
      } else {
        deleteTodo(todo);
      }
    }

    function cancelEdit(todo, e) {
      editingId.value = null;
      e.target.blur();
    }

    // Drag & drop
    function onDragStart(id) {
      if (sortBy.value !== 'default') return;
      dragSrcId       = id;
      draggingId.value = id;
    }

    function onDragEnd() {
      draggingId.value = null;
      dragOverId.value  = null;
    }

    function onDragOver(id) {
      if (sortBy.value !== 'default') return;
      dragOverId.value = id;
    }

    function onDragLeave() {
      dragOverId.value = null;
    }

    function onDrop(targetId) {
      if (sortBy.value !== 'default' || !dragSrcId || dragSrcId === targetId) return;
      dragOverId.value  = null;
      draggingId.value  = null;
      const srcIdx = todos.value.findIndex(t => t.id === dragSrcId);
      const tgtIdx = todos.value.findIndex(t => t.id === targetId);
      if (srcIdx !== -1 && tgtIdx !== -1) {
        const [moved] = todos.value.splice(srcIdx, 1);
        todos.value.splice(tgtIdx, 0, moved);
      }
      dragSrcId = null;
    }

    return {
      todos, filter, sortBy, newTodo, newDue,
      showModal, modalTaskText,
      toastVisible, toastMessage,
      editingId, editText,
      draggingId, dragOverId,
      totalCount, activeCount, doneCount, pct, filteredTodos,
      isOverdue, formatFullDate, formatRemaining,
      addTodo, toggle, deleteTodo, clearCompleted, updateDue,
      startEdit, finishEdit, cancelEdit,
      onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
    };
  }
});

// カスタムディレクティブ: v-focus (インライン編集時に自動フォーカス+全選択)
app.directive('focus', {
  mounted(el) {
    el.focus();
    el.select();
  }
});

app.mount('#app');
