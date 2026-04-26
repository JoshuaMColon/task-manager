// ================================================
// STEP 1: Create our tasks array
// An array [ ] holds a list of items.
// Right now it&#39;s empty. Tasks get added later.
// ================================================

let tasks = [];
//          ^^ empty array - like an empty to-do list

// ================================================
// STEP 2: The addTask function
// This runs when the Add Task button is clicked
// ================================================

function addTask() {
    // Get what the user typed in the input box
    let input = document.getElementById("task-input");
    // .value gets the text the user typed
    let taskText = input.value;
    // GUARD CLAUSE: if the input is empty, do nothing
    // .trim() removes extra spaces
    if (taskText.trim() === "") {
     // ^ opens if condition ^ closes condition ^ opens if body

     alert("Please enter a task first!");

     return; // stops the function here - nothing else runs
}
// ^ closes the if body
// Add the new task text to our tasks array
tasks.push(taskText);

// ^ .push() adds an item to the END of an array
// Clear the input box so it&#39;s ready for the next task
input.value = "";
// Re-draw the task list on screen
renderTasks();
// ^^ calling another function - you&#39;ll write it next
}
// ^ closes the addTask function body

// ================================================
// STEP 3: The renderTasks function
// Draws the task list on screen
// Runs every time anything changes
// ================================================

function renderTasks() {

// Find the &lt;ul&gt; element in the HTML
let list = document.getElementById("task-list");

// Clear whatever is in the list right now
list.innerHTML = "";

// Loop through every task in the tasks array
for (let i = 0; i < tasks.length; i++) {
// ^ start at 0; keep going while i < total tasks; add 1 each loop

// Create a new <li> element for this task
let li = document.createElement("li");
li.className = "task-item";

// Fill the <li> with the task text and two buttons
li.innerHTML =
    '<span class="task-text">' + tasks[i] + '</span>' +
    '<div class="task-actions">' +
       '<button class="btn-done" onclick="completeTask(' + i + ')">Done</button>' +
         '<button class="btn-delete" onclick="deleteTask(' + i + ')">Delete</button>' +
    '</div>';

// Add this <li> into the <ul> list
list.appendChild(li);
}

// ^ closes the for loop

// If no tasks exist, show a message
if (tasks.length === 0) {
list.innerHTML =
    '<li style="color:#475569;font-size:13px;padding:12px 0;text-align:center;">' 
    + 'No tasks yet. Add one above!' + '</li>';
}

// Update the task counter at the top
updateCount();

}
// ^ closes renderTasks

// ================================================
// STEP 4: The updateCount function
// Updates the X tasks remaining counter
// ================================================

function updateCount() {

let countEl = document.getElementById("task-count");

countEl.textContent = tasks.length + " tasks remaining";

}

// ================================================
// STEP 5: The deleteTask function
// Removes a task from the array by its index number
// index = the position of the task (0, 1, 2...)
// ================================================

function deleteTask(index) {
//                   ^ index comes in from the button's onclick

  // .splice(start, deleteCount) removes items from an array
  tasks.splice(index, 1);
  //            ^     ^ delete exactly 1 item

  // Re-draw the list with the task gone
  renderTasks();

}

// ================================================
// STEP 6: The completeTask function
// Toggles a task between done and not-done
// ================================================

function completeTask(index) {
    
  // Get all task-item elements on the page
  let taskItems = document.querySelectorAll(".task-item");

  // Find the specific task item at this index
  let taskEl = taskItems[index];

  // Find the text span inside this task item
  let textEl = textEl.querySelector(".task-text");

  // Toggle: if already complete -> remove it. If not -> add it.
  if (textEl.classList.contains("completed")) {
    // ^ if the task is currently marked complete...

    textEl.classList.remove("completed");
    taskEl.classList.remove("done");

  } else {
    // ^ otherwise (task is NOT complete)...

    textEl.classList.add("completed");
    taskEl.classList.add("done");
  }

}

// ================================================
// STEP 7: Listen for the Enter key
// addEventListener watches for an event on an element
// ================================================

let inputEl = document.getElementById("task-input");

inputEl.addEventListener("keydown", function(event) {
    //        ^ watch for keydown ^ function runs when any key is pressed

    if (event.key === "Enter") {
        //       ^ was it specifically the Enter key?

        addTask();  // run the same addTask function as the button

    }

});
// ^ closes the function ^ closes addEventListener( ) ^ semicolon