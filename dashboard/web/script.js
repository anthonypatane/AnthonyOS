// ==============================
// Anthony OS Clock
// ==============================

function updateClock() {
    const clockElement = document.getElementById("clock");
    const dateElement = document.getElementById("date");

    if (!clockElement && !dateElement) {
        return;
    }

    const now = new Date();

    if (clockElement) {
        clockElement.textContent = now.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit"
        });
    }

    if (dateElement) {
        dateElement.textContent = now.toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        });
    }
}

updateClock();
setInterval(updateClock, 1000);

// ==============================
// Anthony OS Workout Card
// ==============================

function resolveGoal(program, block) {
    const fallback = {
        label: `${block.target.min}-${block.target.max}`
    };

    if (!window.Progression || typeof window.Progression.getNextGoal !== "function") {
        return fallback;
    }

    try {
        return window.Progression.getNextGoal(
            program,
            block.exercise,
            block.target
        ) || fallback;
    } catch (error) {
        console.error("Progression failed for", block.exercise, error);
        return fallback;
    }
}

async function loadWorkoutCard() {
    const workoutName = document.getElementById("workout-name");
    const workoutGoals = document.getElementById("workout-goals");

    if (!workoutName || !workoutGoals) {
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
        const workoutIds = program.schedule?.[today] || [];

        if (workoutIds.length === 0) {
            workoutName.textContent = "Rest Day";
            workoutGoals.innerHTML = "<p>Recover, walk, stretch, and prepare for tomorrow.</p>";
            return;
        }

        const scheduled = workoutIds
            .map(id => program.workouts?.[id])
            .filter(Boolean);

        if (scheduled.length === 0) {
            throw new Error(`No scheduled workout for ${today} was found.`);
        }

        workoutName.textContent = scheduled
            .map(workout => workout.name)
            .join(" + ");

        workoutGoals.innerHTML = "";

        scheduled.forEach(workout => {
            if (workout.type === "activity") {
                const activityElement = document.createElement("div");
                activityElement.className = "workout-goal";

                activityElement.innerHTML = `
                    <strong>${workout.name}</strong>
                    <span>${(workout.options || [])
                        .map(option => option.name)
                        .join(" · ")}</span>
                `;

                workoutGoals.appendChild(activityElement);
            }

            (workout.blocks || []).forEach(block => {
                const exercise = program.exercises?.[block.exercise];

                if (!exercise) {
                    return;
                }

                const goal = resolveGoal(program, block);
                const unit = exercise.metric === "seconds" ? "seconds" : "reps";

                const exerciseElement = document.createElement("div");
                exerciseElement.className = "workout-goal";

                exerciseElement.innerHTML = `
                    <strong>${exercise.name}</strong>
                    <span>${block.sets} sets · ${block.target.min}-${block.target.max} ${unit}</span>
                    <span>Goal: ${goal.label}</span>
                `;

                workoutGoals.appendChild(exerciseElement);
            });
        });
    } catch (error) {
        console.error(error);

        workoutName.textContent = "Workout unavailable";
        workoutGoals.innerHTML = `
            <p>Anthony OS could not load today's workout.</p>
        `;
    }
}

// ==============================
// Anthony OS Daily Briefing
// ==============================

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function renderNutritionCards(today) {
    setText(
        "protein-value",
        `${today.nutrition.protein} / ${today.nutrition.proteinGoal} g`
    );

    setText(
        "water-value",
        `${today.nutrition.waterLiters} / ${today.nutrition.waterGoalLiters} L`
    );

    setText(
        "steps-value",
        `${today.health.steps.toLocaleString()} / ${today.health.stepGoal.toLocaleString()}`
    );
}

function renderBriefing(today, briefing) {
    setText("briefing-greeting", briefing.greeting);

    const dateElement = document.getElementById("briefing-date");

    if (dateElement) {
        dateElement.textContent = new Date(`${today.date}T12:00:00`)
            .toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric"
            });
    }

    setText("briefing-focus", briefing.focus.message);

    const statusElement = document.getElementById("briefing-status");

    if (statusElement) {
        statusElement.textContent = briefing.status.label;
        statusElement.dataset.level = briefing.status.level;
    }

    const steps = briefing.quickLook.steps;
    const calories = briefing.quickLook.activeCalories;

    setText(
        "briefing-steps",
        `👣 Steps: ${steps.current.toLocaleString()} / ${steps.goal.toLocaleString()}`
    );

    setText(
        "briefing-calories",
        `🔥 Calories: ${calories.current.toLocaleString()} ${calories.unit}`
    );

    setText(
        "briefing-assignments",
        `📚 Assignments: ${briefing.quickLook.homework.dueCount} Due`
    );

    setText("briefing-reminder", briefing.reminder);
    setText("briefing-quote", `"${briefing.quote}"`);
}

async function loadDashboard() {
    if (!window.AnthonyCore) {
        console.error("AnthonyCore did not load. Check the script order in your HTML.");
        return;
    }

    try {
        const today = await window.AnthonyCore.getToday();
        const briefing = window.AnthonyCore.getDailyBriefing(today);

        renderNutritionCards(today);
        renderBriefing(today, briefing);
    } catch (error) {
        console.error("Dashboard failed to load:", error);
    }
}

loadWorkoutCard();
loadDashboard();