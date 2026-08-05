"use strict";

const SETS_KEY = "anthonyOSCurrentWorkout";
const START_KEY = "anthonyOSWorkoutStartedAt";

let completedSets = [];
let workoutStartTime = null;
let timerInterval = null;
let currentWorkoutProgram = null;
let currentWorkout = null;

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function formatElapsedTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
        .map(value => String(value).padStart(2, "0"))
        .join(":");
}

function updateWorkoutTimer() {
    const timer = document.getElementById("timer");

    if (!workoutStartTime || !timer) {
        return;
    }

    const elapsedSeconds = Math.floor((Date.now() - workoutStartTime) / 1000);

    timer.textContent = formatElapsedTime(elapsedSeconds);
}

function runTimer() {
    stopTimer();
    updateWorkoutTimer();
    timerInterval = setInterval(updateWorkoutTimer, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function setButtonStates(workoutRunning) {
    const startButton = document.getElementById("start-workout");
    const finishButton = document.getElementById("finish-workout");

    if (startButton) {
        startButton.disabled = workoutRunning;
    }

    if (finishButton) {
        finishButton.disabled = !workoutRunning;
    }
}

function readStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        console.error("Could not read storage:", error);
        return null;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        console.error("Could not save to storage:", error);
    }
}

function clearStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error("Could not clear storage:", error);
    }
}

function persistCompletedSets() {
    writeStorage(SETS_KEY, JSON.stringify(completedSets));
}

function loadCompletedSets() {
    const raw = readStorage(SETS_KEY);

    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("Saved sets were unreadable, starting fresh.", error);
        return [];
    }
}

function hideWorkoutSummary() {
    const summary = document.getElementById("workout-summary");

    if (summary) {
        summary.hidden = true;
    }
}

function showWorkoutSummary(finalTime) {
    const summary = document.getElementById("workout-summary");

    if (!summary) {
        console.warn("No #workout-summary element on the page.");
        return;
    }

    const workoutTitle = document.getElementById("workout-title");
    const exerciseCount = document.querySelectorAll(".exercise-card").length;

    const totalVolume = completedSets.reduce(
        (total, set) => total + set.weight * set.reps,
        0
    );

    setText("summary-workout-name", workoutTitle ? workoutTitle.textContent : "Workout");
    setText("summary-duration", finalTime);
    setText("summary-exercises", exerciseCount);
    setText("summary-sets", completedSets.length);
    setText("summary-volume", `${totalVolume.toLocaleString()} lb`);

    summary.hidden = false;

    summary.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function startWorkout() {
    workoutStartTime = Date.now();
    completedSets = [];

    writeStorage(START_KEY, String(workoutStartTime));
    clearStorage(SETS_KEY);

    hideWorkoutSummary();
    runTimer();
    setButtonStates(true);
    markSavedSetsInUI();
}

function finishWorkout() {
    stopTimer();

    const timer = document.getElementById("timer");
    const finalTime = timer ? timer.textContent : "00:00:00";

    showWorkoutSummary(finalTime);

    clearStorage(START_KEY);
    clearStorage(SETS_KEY);

    workoutStartTime = null;
    completedSets = [];

    setButtonStates(false);
}

function resolveGoal(program, block) {
    const fallback = {
        weight: null,
        reps: block.target.min,
        label: `${block.target.min}-${block.target.max} reps`
    };

    if (!window.Progression || typeof window.Progression.getNextGoal !== "function") {
        return fallback;
    }

    try {
        const goal = window.Progression.getNextGoal(
            program,
            block.exercise,
            block.target
        );

        return goal || fallback;
    } catch (error) {
        console.error("Progression failed for", block.exercise, error);
        return fallback;
    }
}

function buildSetRow(block, setNumber, suggestedWeight, suggestedReps, unitLabel) {
    return `
        <div class="set-row" data-set-number="${setNumber}">
            <div class="set-heading">
                <strong>Set ${setNumber} of ${block.sets}</strong>
                <span class="set-status">Not saved</span>
            </div>

            <div class="set-inputs">
                <label>
                    Weight
                    <input
                        type="number"
                        class="weight-input"
                        min="0"
                        step="1"
                        value="${suggestedWeight}"
                        placeholder="Weight"
                    >
                </label>

                <label>
                    ${unitLabel}
                    <input
                        type="number"
                        class="reps-input"
                        min="0"
                        step="1"
                        value="${suggestedReps}"
                        placeholder="${unitLabel}"
                    >
                </label>
            </div>

            <button
                type="button"
                class="save-set"
                data-set-number="${setNumber}"
            >
                Save Set ${setNumber}
            </button>
        </div>
    `;
}

function buildExerciseCard(program, block, exercise) {
    const goal = resolveGoal(program, block);
    const isTimed = exercise.metric === "seconds";
    const unitLabel = isTimed ? "Seconds" : "Reps";

    const suggestedWeight = Number.isFinite(goal.weight) ? goal.weight : "";

    const suggestedReps = Number.isFinite(goal.reps)
        ? goal.reps
        : Number.isFinite(goal.target)
            ? goal.target
            : block.target.min;

    const card = document.createElement("section");

    card.className = "card exercise-card";
    card.dataset.exerciseId = block.exercise;

    const setRows = Array.from(
        { length: block.sets },
        (_, index) => buildSetRow(
            block,
            index + 1,
            suggestedWeight,
            suggestedReps,
            unitLabel
        )
    ).join("");

    card.innerHTML = `
        <div class="exercise-header">
            <div>
                <h3>${exercise.name}</h3>
                <p>
                    ${block.sets} sets ·
                    ${block.target.min}-${block.target.max}
                    ${isTimed ? "seconds" : "reps"}
                </p>
            </div>

            <p class="exercise-progress">
                <span class="completed-count">0</span>/${block.sets} sets
            </p>
        </div>

        <div class="goal-box">
            <strong>Today's Goal</strong>
            <p>${goal.label}</p>
        </div>

        <div class="set-list">
            ${setRows}
        </div>
    `;

    attachSetHandlers(card);

    return card;
}

function updateCompletedCount(card) {
    const exerciseId = card.dataset.exerciseId;

    const done = completedSets.filter(
        set => set.exercise === exerciseId
    ).length;

    const counter = card.querySelector(".completed-count");

    if (counter) {
        counter.textContent = done;
    }
}

function attachSetHandlers(card) {
    const exerciseId = card.dataset.exerciseId;

    card.querySelectorAll(".save-set").forEach(button => {
        button.addEventListener("click", event => {
            if (!workoutStartTime) {
                alert("Start the workout before saving sets.");
                return;
            }

            const saveButton = event.currentTarget;
            const setRow = saveButton.closest(".set-row");

            const weight = Number(setRow.querySelector(".weight-input").value);
            const reps = Number(setRow.querySelector(".reps-input").value);

            if (!Number.isFinite(weight) || weight < 0 || !Number.isFinite(reps) || reps <= 0) {
                alert("Enter a valid weight and rep amount.");
                return;
            }

            const savedSet = {
                exercise: exerciseId,
                setNumber: Number(saveButton.dataset.setNumber),
                weight,
                reps,
                savedAt: new Date().toISOString()
            };

            const existingIndex = completedSets.findIndex(set =>
                set.exercise === savedSet.exercise &&
                set.setNumber === savedSet.setNumber
            );

            if (existingIndex >= 0) {
                completedSets[existingIndex] = savedSet;
            } else {
                completedSets.push(savedSet);
            }

            setRow.querySelector(".set-status").textContent = "Saved ✓";
            setRow.classList.add("set-complete");
            saveButton.textContent = "Update Set";

            updateCompletedCount(card);
            persistCompletedSets();
        });
    });
}

function markSavedSetsInUI() {
    document.querySelectorAll(".exercise-card").forEach(card => {
        const exerciseId = card.dataset.exerciseId;

        card.querySelectorAll(".set-row").forEach(setRow => {
            const setNumber = Number(setRow.dataset.setNumber);

            const saved = completedSets.find(set =>
                set.exercise === exerciseId && set.setNumber === setNumber
            );

            const status = setRow.querySelector(".set-status");
            const button = setRow.querySelector(".save-set");

            if (saved) {
                setRow.querySelector(".weight-input").value = saved.weight;
                setRow.querySelector(".reps-input").value = saved.reps;
                status.textContent = "Saved ✓";
                setRow.classList.add("set-complete");
                button.textContent = "Update Set";
            } else {
                status.textContent = "Not saved";
                setRow.classList.remove("set-complete");
                button.textContent = `Save Set ${setNumber}`;
            }
        });

        updateCompletedCount(card);
    });
}

function renderRestDay(workoutTitle, exerciseList) {
    workoutTitle.textContent = "Rest Day";
    exerciseList.innerHTML = `
        <section class="card">
            <h3>Recovery Day</h3>
            <p>Walk, stretch, hydrate, and prepare for tomorrow.</p>
        </section>
    `;
}

async function loadTodaysWorkout() {
    const workoutTitle = document.getElementById("workout-title");
    const exerciseList = document.getElementById("exercise-list");

    if (!workoutTitle || !exerciseList) {
        console.error("Missing #workout-title or #exercise-list in the page.");
        return;
    }

    try {
        const response = await fetch("../../data/fitness/workout-plan.json");

        if (!response.ok) {
            throw new Error(`Could not load workout data: ${response.status}`);
        }

        const program = await response.json();

        const dayNames = [
            "sunday",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday"
        ];

        const today = dayNames[new Date().getDay()];
        const workoutIds = program.schedule[today] || [];

        if (workoutIds.length === 0) {
            renderRestDay(workoutTitle, exerciseList);
            return;
        }

        const workoutId = workoutIds[0];
        const workout = program.workouts[workoutId];
        currentWorkoutProgram = program;
        currentWorkout = workout;

        if (!workout) {
            throw new Error(`Workout "${workoutId}" was not found.`);
        }

        workoutTitle.textContent = workout.name;
        exerciseList.innerHTML = "";

        workout.blocks.forEach(block => {
            const exercise = program.exercises[block.exercise];

            if (!exercise) {
                console.warn(`Exercise "${block.exercise}" is missing.`);
                return;
            }

            exerciseList.appendChild(buildExerciseCard(program, block, exercise));
        });
    } catch (error) {
        console.error(error);

        workoutTitle.textContent = "Workout Unavailable";
        exerciseList.innerHTML = `
            <section class="card">
                <h3>Could not load workout</h3>
                <p>Check the workout-plan.json file and today's schedule.</p>
            </section>
        `;
    }
}

function restoreSession() {
    const savedStart = readStorage(START_KEY);
    const parsedStart = Number(savedStart);

    if (savedStart && Number.isFinite(parsedStart) && parsedStart > 0) {
        workoutStartTime = parsedStart;
        completedSets = loadCompletedSets();

        runTimer();
        setButtonStates(true);
        return;
    }

    setButtonStates(false);
}

async function init() {
    const startButton = document.getElementById("start-workout");
    const finishButton = document.getElementById("finish-workout");

    if (startButton) {
        startButton.addEventListener("click", startWorkout);
    }

    if (finishButton) {
        finishButton.addEventListener("click", finishWorkout);
    }

    hideWorkoutSummary();
    restoreSession();

    await loadTodaysWorkout();

    markSavedSetsInUI();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
document
    .getElementById("save-workout")
    .addEventListener("click", () => {
        if (!currentWorkout) {
            alert("No active workout found.");
            return;
        }

        const totalVolume = completedSets.reduce(
            (total, set) => total + (set.weight * set.reps),
            0
        );

        const workoutRecord = {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            workout: currentWorkout.name,
            duration: document.getElementById("timer").textContent,
            completedSets: [...completedSets],
            totalVolume
        };

        window.WorkoutStorage.saveWorkout(workoutRecord);

        alert("Workout saved successfully.");

        console.log("Saved workout:", workoutRecord);
    });