const weekdayNames = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_CHIP_LIMIT = 3; // 달력 한 칸에 보여줄 할 일 개수 (넘으면 +N)

const els = {
  todayDate: document.getElementById("today-date"),
  todayList: document.getElementById("today-list"),
  todayEmpty: document.getElementById("today-empty"),
  addBtn: document.getElementById("add-todo-btn"),
  addTitle: document.getElementById("add-modal-title"),
  addModal: document.getElementById("add-modal"),
  addForm: document.getElementById("add-form"),
  addCancel: document.getElementById("add-cancel"),
  addDelete: document.getElementById("add-delete"),
  postponeModal: document.getElementById("postpone-modal"),
  postponeForm: document.getElementById("postpone-form"),
  postponeCancel: document.getElementById("postpone-cancel"),
  postponeHint: document.getElementById("postpone-hint"),
  calendarGrid: document.getElementById("calendar-grid"),
  rangeLabel: document.getElementById("range-label"),
  prevRange: document.getElementById("prev-range"),
  nextRange: document.getElementById("next-range"),
  todayBtn: document.getElementById("today-btn"),
  dayModal: document.getElementById("day-modal"),
  dayModalTitle: document.getElementById("day-modal-title"),
  dayClose: document.getElementById("day-close"),
  dayList: document.getElementById("day-list"),
  dayEmpty: document.getElementById("day-empty"),
  viewButtons: document.querySelectorAll("[data-view]"),
  filterButtons: document.querySelectorAll("[data-filter]"),
  historyList: document.getElementById("history-list"),
  historyEmpty: document.getElementById("history-empty"),
};

const state = {
  todos: [], // 브라우저 저장소를 쓰지 않아서, 새로고침하면 목록이 초기화돼요
  view: "month",
  cursor: startOfDay(new Date()),
  selected: startOfDay(new Date()),
  postponeId: null,
  editId: null,
  filter: "all",
};

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function toLocalParts(date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function fromParts(year, month, day, time) {
  const [hh, mm] = time.split(":").map(Number);
  const date = new Date(Number(year), Number(month) - 1, Number(day), hh, mm, 0, 0);
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    throw new Error("invalid-date");
  }
  return date;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDate(date, withWeekday = true) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = weekdayNames[date.getDay()];
  return withWeekday ? `${y}년 ${m}월 ${d}일 (${w})` : `${y}년 ${m}월 ${d}일`;
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function todosOnDay(day) {
  return state.todos
    .filter((t) => sameDay(new Date(t.due), day))
    .sort((a, b) => new Date(a.due) - new Date(b.due));
}

function fillDateFields(form, date) {
  const parts = toLocalParts(date);
  form.year.value = parts.year;
  form.month.value = parts.month;
  form.day.value = parts.day;
  form.time.value = parts.time;
}

function renderToday() {
  const now = new Date();
  els.todayDate.textContent = formatDate(now);
  const items = todosOnDay(now);
  els.todayList.innerHTML = "";
  els.todayEmpty.hidden = items.length > 0;

  for (const todo of items) {
    els.todayList.appendChild(createTodoItem(todo, true));
  }
}

function createTodoItem(todo, withActions) {
  const li = document.createElement("li");
  li.className = "todo-item" + (todo.done ? " is-done" : "");

  const body = document.createElement("div");
  const title = document.createElement("p");
  title.className = "todo-item__title";
  title.textContent = todo.title;

  const meta = document.createElement("p");
  meta.className = "todo-item__meta";
  const due = new Date(todo.due);
  meta.textContent = `${formatDate(due, false)} ${formatTime(due)}${todo.done ? " · 완료" : ""}`;

  body.append(title, meta);
  if (todo.detail) {
    const detail = document.createElement("p");
    detail.className = "todo-item__detail";
    detail.textContent = todo.detail;
    body.append(detail);
  }
  li.append(body);

  // 항목을 누르면 수정 팝업 열기 (완료·미루기 버튼은 제외)
  li.classList.add("is-editable");
  body.className = "todo-item__body";
  body.tabIndex = 0;
  body.setAttribute("role", "button");
  body.setAttribute("aria-label", `${todo.title} 수정하기`);
  body.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openEdit(todo);
    }
  });
  li.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    openEdit(todo);
  });

  if (withActions && !todo.done) {
    const actions = document.createElement("div");
    actions.className = "todo-item__actions";

    const doneBtn = document.createElement("button");
    doneBtn.className = "btn btn--small";
    doneBtn.type = "button";
    doneBtn.textContent = "완료";
    doneBtn.addEventListener("click", () => completeTodo(todo.id));

    const postponeBtn = document.createElement("button");
    postponeBtn.className = "btn btn--small";
    postponeBtn.type = "button";
    postponeBtn.textContent = "미루기";
    postponeBtn.addEventListener("click", () => openPostpone(todo));

    actions.append(doneBtn, postponeBtn);
    li.append(actions);
  }

  return li;
}

// 달력 칸 안에 표시되는 작은 할 일 표시
function createChip(todo) {
  const due = new Date(todo.due);
  const li = document.createElement("li");
  li.className = "chip" + (todo.done ? " is-done" : "");
  li.title = `${formatTime(due)} ${todo.title}`;

  const time = document.createElement("span");
  time.className = "chip__time";
  time.textContent = formatTime(due);

  const title = document.createElement("span");
  title.className = "chip__title";
  title.textContent = todo.title;

  li.append(time, title);

  // 달력 칸의 할 일을 누르면 수정 팝업 열기 (날짜 선택 동작은 막음)
  if (!li.classList.contains("chip--more")) {
    li.addEventListener("click", (event) => {
      event.stopPropagation();
      openEdit(todo);
    });
  }
  return li;
}

function openAddModal() {
  state.editId = null;
  els.addTitle.textContent = "할 일 추가하기";
  els.addDelete.hidden = true;
  resetDeleteButton();
  els.addForm.reset();
  fillDateFields(els.addForm, new Date());
  els.addModal.showModal();
  els.addForm.title.focus();
}

function openEdit(todo) {
  state.editId = todo.id;
  els.addTitle.textContent = "할 일 수정하기";
  els.addDelete.hidden = false;
  resetDeleteButton();
  els.addForm.reset();
  els.addForm.title.value = todo.title;
  els.addForm.detail.value = todo.detail || "";
  fillDateFields(els.addForm, new Date(todo.due));
  els.addModal.showModal();
  els.addForm.title.focus();
}

// 삭제는 두 번 눌러야 실행돼요 (실수 방지)
let deleteTimer = null;

function resetDeleteButton() {
  clearTimeout(deleteTimer);
  els.addDelete.classList.remove("is-armed");
  els.addDelete.textContent = "삭제";
}

function completeTodo(id) {
  const todo = state.todos.find((t) => t.id === id);
  if (!todo) return;
  todo.done = true;
  render();
}

function openPostpone(todo) {
  state.postponeId = todo.id;
  els.postponeHint.textContent = `「${todo.title}」의 종료일을 다시 정합니다.`;
  fillDateFields(els.postponeForm, new Date(todo.due));
  els.postponeModal.showModal();
}

function renderCalendar() {
  els.viewButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.view === state.view);
  });

  if (state.view === "month") {
    renderMonth();
  } else {
    renderWeek();
  }
  renderDayModal();
}

function renderMonth() {
  const year = state.cursor.getFullYear();
  const month = state.cursor.getMonth();
  els.rangeLabel.textContent = `${year}년 ${month + 1}월`;

  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());

  const table = document.createElement("table");
  table.className = "cal";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  weekdayNames.forEach((name) => {
    const th = document.createElement("th");
    th.textContent = name;
    headRow.append(th);
  });
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  const cursorDay = new Date(start);
  for (let w = 0; w < 6; w++) {
    const tr = document.createElement("tr");
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(cursorDay);
      const td = document.createElement("td");
      if (cellDate.getMonth() !== month) td.classList.add("is-muted");
      if (sameDay(cellDate, new Date())) td.classList.add("is-today");
      if (sameDay(cellDate, state.selected)) td.classList.add("is-selected");

      const btn = document.createElement("button");
      btn.className = "day";
      btn.type = "button";
      btn.addEventListener("click", () => selectDay(cellDate));

      const num = document.createElement("span");
      num.className = "day__num";
      num.textContent = String(cellDate.getDate());
      btn.append(num);

      const dots = document.createElement("ul");
      dots.className = "day__dots";
      const dayTodos = todosOnDay(cellDate);
      dayTodos.slice(0, MONTH_CHIP_LIMIT).forEach((todo) => dots.append(createChip(todo)));
      if (dayTodos.length > MONTH_CHIP_LIMIT) {
        const more = document.createElement("li");
        more.className = "chip chip--more";
        more.textContent = `+${dayTodos.length - MONTH_CHIP_LIMIT}`;
        dots.append(more);
      }
      btn.append(dots);
      td.append(btn);
      tr.append(td);
      cursorDay.setDate(cursorDay.getDate() + 1);
    }
    tbody.append(tr);
  }
  table.append(tbody);
  els.calendarGrid.replaceChildren(table);
}

function startOfWeek(date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function renderWeek() {
  const start = startOfWeek(state.cursor);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const endText =
    start.getFullYear() === end.getFullYear()
      ? `${end.getMonth() + 1}월 ${end.getDate()}일`
      : formatDate(end, false);
  els.rangeLabel.textContent = `${formatDate(start, false)} – ${endText}`;

  const wrap = document.createElement("div");
  wrap.className = "week";

  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const cell = document.createElement("div");
    cell.className = "week__cell";
    if (sameDay(day, new Date())) cell.classList.add("is-today");
    if (sameDay(day, state.selected)) cell.classList.add("is-selected");

    const head = document.createElement("button");
    head.className = "head";
    head.type = "button";
    head.addEventListener("click", () => selectDay(day));
    head.innerHTML = `<span>${weekdayNames[day.getDay()]}</span><span>${day.getDate()}</span>`;
    cell.append(head);

    const list = document.createElement("ul");
    list.className = "week__todos";
    todosOnDay(day).forEach((todo) => list.append(createChip(todo)));
    cell.append(list);
    wrap.append(cell);
  }

  els.calendarGrid.replaceChildren(wrap);
}

function selectDay(date) {
  state.selected = startOfDay(date);
  render();
  if (!els.dayModal.open) els.dayModal.showModal();
}

// 달력에서 날짜를 누르면 뜨는 "그날의 할 일" 팝업
function renderDayModal() {
  els.dayModalTitle.textContent = `${formatDate(state.selected)}의 할 일`;
  const items = todosOnDay(state.selected);
  els.dayList.innerHTML = "";
  els.dayEmpty.hidden = items.length > 0;
  items.forEach((todo) => els.dayList.appendChild(createTodoItem(todo, true)));
}

const emptyMessages = {
  all: "아직 등록된 할 일이 없습니다.",
  todo: "미완료 할 일이 없습니다.",
  done: "완료한 할 일이 없습니다.",
};

function renderHistory() {
  els.filterButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.filter === state.filter);
  });

  const items = state.todos
    .filter((t) => {
      if (state.filter === "done") return t.done;
      if (state.filter === "todo") return !t.done;
      return true;
    })
    .sort((a, b) => new Date(b.due) - new Date(a.due));

  els.historyList.innerHTML = "";
  els.historyEmpty.textContent = emptyMessages[state.filter];
  els.historyEmpty.hidden = items.length > 0;
  items.forEach((todo) => els.historyList.appendChild(createTodoItem(todo, true)));
}

function shiftRange(dir) {
  const next = new Date(state.cursor);
  if (state.view === "month") {
    next.setMonth(next.getMonth() + dir);
  } else {
    next.setDate(next.getDate() + dir * 7);
  }
  state.cursor = startOfDay(next);
  renderCalendar();
}

function render() {
  renderToday();
  renderCalendar();
  renderHistory();
}

function readDateFromForm(form) {
  return fromParts(form.year.value, form.month.value, form.day.value, form.time.value);
}

els.addBtn.addEventListener("click", openAddModal);

els.addModal.addEventListener("close", () => {
  state.editId = null;
  resetDeleteButton();
});

els.addDelete.addEventListener("click", () => {
  if (!state.editId) return;
  if (!els.addDelete.classList.contains("is-armed")) {
    els.addDelete.classList.add("is-armed");
    els.addDelete.textContent = "정말 삭제할까요?";
    deleteTimer = setTimeout(resetDeleteButton, 3000);
    return;
  }
  state.todos = state.todos.filter((t) => t.id !== state.editId);
  els.addModal.close();
  render();
});

els.filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.filter = btn.dataset.filter;
    renderHistory();
  });
});

els.dayClose.addEventListener("click", () => els.dayModal.close());
els.dayModal.addEventListener("click", (event) => {
  if (event.target === els.dayModal) els.dayModal.close(); // 바깥(배경)을 누르면 닫기
});

els.addCancel.addEventListener("click", () => els.addModal.close());
els.postponeCancel.addEventListener("click", () => els.postponeModal.close());

els.addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const due = readDateFromForm(els.addForm);
    const title = els.addForm.title.value.trim();
    const detail = els.addForm.detail.value.trim();
    const editing = state.todos.find((t) => t.id === state.editId);
    if (editing) {
      editing.title = title;
      editing.detail = detail;
      editing.due = due.toISOString();
    } else {
      state.todos.push({
        id: crypto.randomUUID(),
        title,
        detail,
        due: due.toISOString(),
        done: false,
      });
    }
    if (!els.dayModal.open) {
      state.selected = startOfDay(due);
      state.cursor = startOfDay(due);
    }
    state.editId = null;
    els.addModal.close();
    render();
  } catch {
    alert("올바른 날짜를 입력해 주세요.");
  }
});

els.postponeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const todo = state.todos.find((t) => t.id === state.postponeId);
  if (!todo) return;
  try {
    const due = readDateFromForm(els.postponeForm);
    todo.due = due.toISOString();
    if (!els.dayModal.open) {
      state.selected = startOfDay(due);
      state.cursor = startOfDay(due);
    }
    state.postponeId = null;
    els.postponeModal.close();
    render();
  } catch {
    alert("올바른 날짜를 입력해 주세요.");
  }
});

els.viewButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.view = btn.dataset.view;
    renderCalendar();
  });
});

els.prevRange.addEventListener("click", () => shiftRange(-1));
els.nextRange.addEventListener("click", () => shiftRange(1));
els.todayBtn.addEventListener("click", () => {
  state.cursor = startOfDay(new Date());
  state.selected = startOfDay(new Date());
  render();
});

render();
