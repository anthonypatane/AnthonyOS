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

function formatClassTime(time) {
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;

    return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
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
    const homeworkCount = today.school?.homework?.length ?? 0;

    if (classes.length > 0) {
        const firstClass = classes[0];

        setText(
            "classes-summary",
            `${formatClassTime(firstClass.start)} · ${firstClass.code}`
        );

        setText(
            "classes-detail",
            classes.length === 1
                ? `${firstClass.name} · ${firstClass.location}`
                : `Next: ${classes[1].code} at ${formatClassTime(classes[1].start)}`
        );
    } else {
        setText("classes-summary", "Online coursework");
        setText(
            "classes-detail",
            `${onlineClassCount} online course${onlineClassCount === 1 ? "" : "s"} available`
        );
    }

    setText(
        "homework-summary",
        homeworkCount === 0
            ? "Nothing due"
            : `${homeworkCount} item${homeworkCount === 1 ? "" : "s"} due`
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
