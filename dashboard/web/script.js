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
// Anthony OS Weather
// ==============================

function describeWeather(code, isDay) {
    if (code === 0) {
        return { label: "Clear", icon: isDay ? "☀" : "☾" };
    }

    if ([1, 2].includes(code)) {
        return { label: "Partly cloudy", icon: isDay ? "🌤" : "☁" };
    }

    if (code === 3) {
        return { label: "Cloudy", icon: "☁" };
    }

    if ([45, 48].includes(code)) {
        return { label: "Foggy", icon: "≋" };
    }

    if ([51, 53, 55, 56, 57].includes(code)) {
        return { label: "Drizzle", icon: "🌦" };
    }

    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
        return { label: "Rain", icon: "🌧" };
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
        return { label: "Snow", icon: "❄" };
    }

    if ([95, 96, 99].includes(code)) {
        return { label: "Thunderstorms", icon: "⚡" };
    }

    return { label: "Current conditions", icon: "☁" };
}

async function loadWeather() {
    try {
        const settingsResponse = await fetch("../../data/system/location.json");

        if (!settingsResponse.ok) {
            throw new Error(`Could not load location settings: ${settingsResponse.status}`);
        }

        const location = await settingsResponse.json();
        const searchName = `${location.city}, ${location.region}`;
        const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");

        geocodingUrl.search = new URLSearchParams({
            name: searchName,
            count: "1",
            language: "en",
            format: "json",
            countryCode: location.countryCode
        });

        const locationResponse = await fetch(geocodingUrl);

        if (!locationResponse.ok) {
            throw new Error(`Could not find weather location: ${locationResponse.status}`);
        }

        const locationData = await locationResponse.json();
        const match = locationData.results?.[0];

        if (!match) {
            throw new Error(`No weather location matched ${searchName}.`);
        }

        const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");

        forecastUrl.search = new URLSearchParams({
            latitude: match.latitude,
            longitude: match.longitude,
            current: "temperature_2m,apparent_temperature,weather_code,is_day",
            temperature_unit: "fahrenheit",
            timezone: "auto"
        });

        const weatherResponse = await fetch(forecastUrl);

        if (!weatherResponse.ok) {
            throw new Error(`Could not load current weather: ${weatherResponse.status}`);
        }

        const weather = await weatherResponse.json();
        const current = weather.current;
        const condition = describeWeather(current.weather_code, current.is_day === 1);

        setText("weather-icon", condition.icon);
        setText("weather-temperature", `${Math.round(current.temperature_2m)}°`);
        setText(
            "weather-condition",
            `${condition.label} · Feels like ${Math.round(current.apparent_temperature)}°`
        );
        setText("weather-location", `${match.name}, ${match.admin1}`);
    } catch (error) {
        console.error("Weather failed to load:", error);
        setText("weather-temperature", "--°");
        setText("weather-condition", "Weather unavailable");
        setText("weather-location", "Check location or internet connection");
    }
}

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
        const response = await fetch("../../data/fitness/workout-plan.json", {
            cache: "no-store"
        });

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

        const exerciseCount = scheduled.reduce(
            (count, workout) => count + (workout.blocks?.length || 0),
            0
        );

        workoutName.textContent = `${scheduled
            .map(workout => workout.name)
            .join(" + ")} · ${exerciseCount} exercises`;

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

function formatClassTime(time) {
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;

    return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatAssignmentDue(due) {
    return new Date(due).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function formatAssignmentTime(due) {
    return new Date(due).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
    });
}

function createAssignmentRow(assignment, dueToday = false) {
    const row = document.createElement("div");
    const isComplete = assignment.status === "completed";
    const dueLabel = dueToday
        ? `Today ${formatAssignmentTime(assignment.due)}`
        : formatAssignmentDue(assignment.due);

    row.className = "assignment-row";
    row.innerHTML = `
        <div class="assignment-copy">
            <strong>${assignment.course} · ${assignment.title}</strong>
            <span>${dueLabel}</span>
        </div>
        <span class="assignment-status ${isComplete ? "is-complete" : "is-open"}">
            ${isComplete ? "✓ Complete" : "○ Not Yet"}
        </span>
    `;

    return row;
}

function appendAssignmentSection(list, title, assignments, dueToday = false) {
    const heading = document.createElement("p");

    heading.className = "assignment-section-title";
    heading.textContent = `${title} · ${assignments.length}`;
    list.appendChild(heading);

    assignments.forEach(assignment => {
        list.appendChild(createAssignmentRow(assignment, dueToday));
    });
}

function appendCourseSummary(list, courses) {
    const heading = document.createElement("p");

    heading.className = "assignment-section-title";
    heading.textContent = "All Classes";
    list.appendChild(heading);

    courses.forEach(course => {
        const row = document.createElement("div");

        row.className = "course-progress-row";
        row.innerHTML = `
            <strong>${course.course}</strong>
            <span><b>${course.completed} done</b> · ${course.remaining} left</span>
        `;
        list.appendChild(row);
    });
}

function renderHomeworkCard(overview) {
    const list = document.getElementById("homework-list");
    const courseSummary = overview?.courseSummary ?? [];
    const overdue = overview?.overdue ?? [];
    const dueToday = overview?.dueToday ?? [];
    const upcoming = overview?.upcoming ?? [];
    const recentCompleted = overview?.recentCompleted ?? [];
    const completedCount = courseSummary.reduce(
        (total, course) => total + course.completed,
        0
    );
    const incompleteCount = courseSummary.reduce(
        (total, course) => total + course.remaining,
        0
    );

    setText(
        "homework-summary",
        `${completedCount} done · ${incompleteCount} still need done`
    );
    setText(
        "homework-detail",
        incompleteCount === 0
            ? "Everything shown is complete"
            : `Scroll for all · ${incompleteCount} assignment${incompleteCount === 1 ? "" : "s"} not yet complete`
    );

    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (courseSummary.length === 0) {
        const empty = document.createElement("p");

        empty.className = "homework-empty";
        empty.textContent = "Nothing due in the next 7 days.";
        list.appendChild(empty);
        return;
    }

    appendCourseSummary(list, courseSummary);

    if (overdue.length > 0) {
        appendAssignmentSection(list, "Overdue — Do Now", overdue);
    }

    if (dueToday.length > 0) {
        appendAssignmentSection(list, "Due Today", dueToday, true);
    }

    if (upcoming.length > 0) {
        appendAssignmentSection(list, "Due Next 7 Days", upcoming);
    }

    if (recentCompleted.length > 0) {
        appendAssignmentSection(list, "Recently Completed", recentCompleted);
    }
}

function classTimeToMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);

    return (hours * 60) + minutes;
}

function renderClassesCard(classes, onlineClassCount, now = new Date()) {
    const currentMinutes = (now.getHours() * 60) + now.getMinutes();
    const currentClass = classes.find(course => {
        const start = classTimeToMinutes(course.start);
        const end = classTimeToMinutes(course.end);

        return currentMinutes >= start && currentMinutes < end;
    });

    if (currentClass) {
        setText("classes-summary", `Now · ${currentClass.code}`);
        setText(
            "classes-detail",
            `Until ${formatClassTime(currentClass.end)} · ${currentClass.location}`
        );
        return;
    }

    const nextClass = classes.find(
        course => classTimeToMinutes(course.start) > currentMinutes
    );

    if (nextClass) {
        setText("classes-summary", `Next · ${nextClass.code}`);
        setText(
            "classes-detail",
            `${formatClassTime(nextClass.start)}–${formatClassTime(nextClass.end)} · ${nextClass.location}`
        );
        return;
    }

    if (classes.length > 0) {
        setText("classes-summary", "No more classes");
    } else {
        setText("classes-summary", "Online coursework");
    }

    setText(
        "classes-detail",
        `${onlineClassCount} online course${onlineClassCount === 1 ? "" : "s"} available`
    );
}

function renderDashboardCards(today) {
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

    setText(
        "calories-value",
        `${today.health.activeCalories.toLocaleString()} kcal`
    );

    setText(
        "sleep-value",
        today.health.sleepHours === null
            ? "Not connected"
            : `${today.health.sleepHours} hr`
    );

    setText(
        "recovery-value",
        today.health.recoveryScore === null
            ? "--"
            : `${today.health.recoveryScore}%`
    );

    const classes = today.school?.classes ?? [];
    const onlineClassCount = today.school?.onlineClasses?.length ?? 0;

    renderClassesCard(classes, onlineClassCount);
    renderHomeworkCard(today.school?.assignmentOverview);
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

}

async function loadDashboard() {
    if (!window.AnthonyCore) {
        console.error("AnthonyCore did not load. Check the script order in your HTML.");
        return;
    }

    try {
        const today = await window.AnthonyCore.getToday();
        const briefing = window.AnthonyCore.getDailyBriefing(today);

        renderDashboardCards(today);
        renderBriefing(today, briefing);
    } catch (error) {
        console.error("Dashboard failed to load:", error);
    }
}

loadWorkoutCard();
loadDashboard();
loadWeather();

setInterval(loadDashboard, 60 * 1000);
setInterval(loadWorkoutCard, 60 * 1000);
setInterval(loadWeather, 15 * 60 * 1000);
