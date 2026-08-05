// ==============================
// Anthony OS Clock
// ==============================

function updateClock() {

    const now = new Date();

    const time = now.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });

    const date = now.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    document.getElementById("clock").textContent = time;

    document.getElementById("date").textContent = date;

}

updateClock();

setInterval(updateClock, 1000);
// ==============================
// Anthony OS Workout Card
// ==============================

async function loadWorkoutCard() {
    const workoutName = document.getElementById("workout-name");
    const workoutGoals = document.getElementById("workout-goals");

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
            workoutName.textContent = "Rest Day";
            workoutGoals.innerHTML = "<p>Recover, walk, stretch, and prepare for tomorrow.</p>";
            return;
        }

        const workoutId = workoutIds[0];
        const workout = program.workouts[workoutId];

        if (!workout) {
            throw new Error(`Workout "${workoutId}" was not found.`);
        }

        workoutName.textContent = workout.name;
        workoutGoals.innerHTML = "";

        workout.blocks.forEach(block => {
            const exercise = program.exercises[block.exercise];

            if (!exercise) {
                return;
            }

            const goal = window.Progression.getNextGoal(
                program,
                block.exercise,
                block.target
            );

            const exerciseElement = document.createElement("div");
            exerciseElement.className = "workout-goal";

            exerciseElement.innerHTML = `
                <strong>${exercise.name}</strong>
                <span>${block.sets} sets · ${block.target.min}-${block.target.max} reps</span>
                <span>Goal: ${goal.label}</span>
            `;

            workoutGoals.appendChild(exerciseElement);
        });
    } catch (error) {
        console.error(error);

        workoutName.textContent = "Workout unavailable";
        workoutGoals.innerHTML = `
            <p>Anthony OS could not load today’s workout.</p>
        `;
    }
}

loadWorkoutCard();
(async () => {
    const today = await AnthonyCore.getToday();

    console.log(today);

    const proteinCard = document.getElementById("protein-value");
    const waterCard = document.getElementById("water-value");
    const stepsCard = document.getElementById("steps-value");

    if (proteinCard) {
        proteinCard.textContent =
            `${today.nutrition.protein} / ${today.nutrition.proteinGoal} g`;
    }

    if (waterCard) {
        waterCard.textContent =
            `${today.nutrition.waterLiters} / ${today.nutrition.waterGoalLiters} L`;
    }

    if (stepsCard) {
        stepsCard.textContent =
            `${today.health.steps.toLocaleString()} / 10,000`;
    }
})();