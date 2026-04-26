let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
let currentFilter = "all";
let darkMode = localStorage.getItem("darkMode") === "true";

// Apply saved theme on page load
applyTheme();

function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

// ================================================
// toggleTheme - switches between dark and light mode
// ================================================

function toggleTheme() {
    darkMode = !darkMode;
    localStorage.setItem("darkMode", darkMode);
    applyTheme();
}

function applyTheme() {
    let body = document.body;
    let container = document.querySelector(".container");
    let toggleBtn = document.getElementById("theme-toggle");

    if (darkMode) {
        body.classList.add("dark");
        body.classList.remove("light");
        if (toggleBtn) toggleBtn.textContent = "☀️ Light";
    } else {
        body.classList.add("light");
        body.classList.remove("dark");
        if (toggleBtn) toggleBtn.textContent = "🌙 Dark";
    }
}

// ================================================
// updateProgress - updates the progress bar
// ================================================

function updateProgress() {
    let total = tasks.length;
    let completed = tasks.filter(function(task) {
        return task.completed;
    }).length;

    let fill = document.getElementById("progress-fill");
    let label = document.getElementById("progress-label");

    let percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    fill.style.width = percent + "%";
    label.textContent = completed + " of " + total + " completed";

    // Change color based on progress
    if (percent === 100 && total > 0) {
        fill.style.backgroundColor = "#22c55e"; // green when all done
    } else if (percent >= 50) {
        fill.style.backgroundColor = "#3b82f6"; // blue at 50%+
    } else {
        fill.style.backgroundColor = "#6366f1"; // purple under 50%
    }
}

// ================================================
// addTask
// ================================================

function addTask() {
    let input = document.getElementById("task-input");
    let taskText = input.value;

    if (taskText.trim() === "") {
        alert("Please enter a task first!");
        return;
    }

    let date = document.getElementById("task-date").value;
    let priority = document.getElementById("task-priority").value;

    tasks.push({
        text: taskText,
        completed: false,
        date: date,
        priority: priority
    });

    input.value = "";
    document.getElementById("task-date").value = "";
    document.getElementById("task-priority").value = "medium";

    saveTasks();
    renderTasks();
}

// ================================================
// setFilter
// ================================================

function setFilter(filter) {
    currentFilter = filter;

    let buttons = document.querySelectorAll(".filter-btn");
    buttons.forEach(function(btn) {
        btn.classList.remove("filter-active");
    });
    document.getElementById("filter-" + filter).classList.add("filter-active");

    renderTasks();
}

// ================================================
// getPriorityLabel
// ================================================

function getPriorityLabel(priority) {
    if (priority === "high") return '<span class="priority high">🔴 High</span>';
    if (priority === "medium") return '<span class="priority medium">🟡 Medium</span>';
    return '<span class="priority low">🟢 Low</span>';
}

// ================================================
// formatDate
// ================================================

function formatDate(dateStr) {
    if (!dateStr) return "";
    let date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

// ================================================
// isOverdue
// ================================================

function isOverdue(dateStr, completed) {
    if (!dateStr || completed) return false;
    let today = new Date();
    today.setHours(0, 0, 0, 0);
    let due = new Date(dateStr + "T00:00:00");
    return due < today;
}

// ================================================
// editTask
// ================================================

function editTask(index) {
    let task = tasks[index];
    let taskEl = document.querySelector('[data-index="' + index + '"]');
    let taskLeft = taskEl.querySelector(".task-left");

    taskLeft.innerHTML =
        '<input type="text" class="edit-input" id="edit-input-' + index + '" value="' + task.text + '">' +
        '<div class="edit-extra-row">' +
            '<input type="date" class="edit-date" id="edit-date-' + index + '" value="' + (task.date || "") + '">' +
            '<select class="edit-priority" id="edit-priority-' + index + '">' +
                '<option value="low"' + (task.priority === "low" ? " selected" : "") + '>🟢 Low</option>' +
                '<option value="medium"' + (task.priority === "medium" ? " selected" : "") + '>🟡 Medium</option>' +
                '<option value="high"' + (task.priority === "high" ? " selected" : "") + '>🔴 High</option>' +
            '</select>' +
        '</div>' +
        '<div class="edit-actions">' +
            '<button class="btn-save" onclick="saveEdit(' + index + ')">Save</button>' +
            '<button class="btn-cancel" onclick="renderTasks()">Cancel</button>' +
        '</div>';

    let taskActions = taskEl.querySelector(".task-actions");
    taskActions.style.display = "none";

    let editInput = document.getElementById("edit-input-" + index);
    editInput.focus();
    editInput.setSelectionRange(editInput.value.length, editInput.value.length);

    editInput.addEventListener("keydown", function(event) {
        if (event.key === "Enter") saveEdit(index);
        if (event.key === "Escape") renderTasks();
    });
}

// ================================================
// saveEdit
// ================================================

function saveEdit(index) {
    let newText = document.getElementById("edit-input-" + index).value;
    let newDate = document.getElementById("edit-date-" + index).value;
    let newPriority = document.getElementById("edit-priority-" + index).value;

    if (newText.trim() === "") {
        alert("Task text cannot be empty!");
        return;
    }

    tasks[index].text = newText;
    tasks[index].date = newDate;
    tasks[index].priority = newPriority;

    saveTasks();
    renderTasks();
}

// ================================================
// renderTasks
// ================================================

function renderTasks() {
    let list = document.getElementById("task-list");
    list.innerHTML = "";

    let filteredTasks = tasks.filter(function(task) {
        if (currentFilter === "active") return !task.completed;
        if (currentFilter === "completed") return task.completed;
        return true;
    });

    let priorityOrder = { high: 0, medium: 1, low: 2 };
    filteredTasks.sort(function(a, b) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    for (let i = 0; i < filteredTasks.length; i++) {
        let task = filteredTasks[i];
        let realIndex = tasks.indexOf(task);
        let overdue = isOverdue(task.date, task.completed);

        let li = document.createElement("li");
        li.className = "task-item"
            + (task.completed ? " done" : "")
            + (overdue ? " overdue" : "");
        li.setAttribute("data-index", realIndex);

        let dateHtml = "";
        if (task.date) {
            dateHtml = '<span class="task-date' + (overdue ? " overdue-text" : "") + '">'
                + (overdue ? "⚠️ Overdue · " : "📅 ")
                + formatDate(task.date) + '</span>';
        }

        li.innerHTML =
            '<div class="task-left">' +
                '<span class="task-text' + (task.completed ? " completed" : "") + '">'
                + task.text + '</span>' +
                '<div class="task-meta">' +
                    getPriorityLabel(task.priority) +
                    dateHtml +
                '</div>' +
            '</div>' +
            '<div class="task-actions">' +
                '<button class="btn-edit" onclick="editTask(' + realIndex + ')">Edit</button>' +
                '<button class="btn-done" onclick="completeTask(' + realIndex + ')">'
                + (task.completed ? "Undo" : "Done") + '</button>' +
                '<button class="btn-delete" onclick="deleteTask(' + realIndex + ')">Delete</button>' +
            '</div>';

        list.appendChild(li);
    }

    if (filteredTasks.length === 0) {
        list.innerHTML =
            '<li style="font-size:13px;padding:12px 0;text-align:center;">'
            + (tasks.length === 0 ? 'No tasks yet. Add one above!' : 'No ' + currentFilter + ' tasks.')
            + '</li>';
    }

    updateCount();
    updateProgress(); // ✅ update progress bar every render
}

// ================================================
// updateCount
// ================================================

function updateCount() {
    let countEl = document.getElementById("task-count");
    let remaining = tasks.filter(function(task) {
        return !task.completed;
    }).length;
    countEl.textContent = remaining + " tasks remaining";
}

// ================================================
// deleteTask
// ================================================

function deleteTask(index) {
    tasks.splice(index, 1);
    saveTasks();
    renderTasks();
}

// ================================================
// completeTask
// ================================================

function completeTask(index) {
    tasks[index].completed = !tasks[index].completed;
    saveTasks();
    renderTasks();
}

// ================================================
// Enter key listener
// ================================================

let inputEl = document.getElementById("task-input");

inputEl.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        addTask();
    }
});

// ================================================
// Render on page load
// ================================================

renderTasks();