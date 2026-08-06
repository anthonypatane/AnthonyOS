"use strict";

/*
=========================================
Anthony OS — Anthony Core
Version: 0.1

Purpose:
Provide one central place for Anthony OS
to understand and return today's data.
=========================================
*/

/**
 * Return a greeting based on the current hour.
 */
function getGreeting(date = new Date()) {
    const hour = date.getHours();

    if (hour < 12) {
        return "Good morning, Anthony";
    }

    if (hour < 18) {
        return "Good afternoon, Anthony";
    }

    return "Good evening, Anthony";
}

/**
 * Return the current day name in lowercase.
 */
function getDayName(date = new Date()) {
    const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday"
    ];

    return days[date.getDay()];
}

/**
 * Return the date in YYYY-MM-DD format.
 */
function getIsoDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

/**
 * Load JSON data from a project file.
 */
async function loadJson(path) {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(
            `Could not load ${path}. Status: ${response.status}`
        );
    }

    return response.json();
}

/**
 * Return today's workout information.
 */
async function getTodayWorkout() {
    const program = await loadJson(
        "../../data/fitness/workout-plan.json"
    );

    const day = getDayName();
    const workoutIds = program.schedule?.[day] || [];

    if (workoutIds.length === 0) {
        return {
            restDay: true,
            name: "Rest Day",
            workoutId: null,
            exercises: []
        };
    }

    const scheduled = workoutIds
        .map(id => ({ id, workout: program.workouts?.[id] }))
        .filter(item => Boolean(item.workout));

    if (scheduled.length === 0) {
        return {
            restDay: false,
            name: "Workout Unavailable",
            workoutId: workoutIds[0],
            workoutIds,
            exercises: [],
            error: `Workout "${workoutIds[0]}" was not found.`
        };
    }

    const exercises = scheduled.flatMap(({ workout }) =>
        (workout.blocks || []).map(block => {
            const exercise = program.exercises?.[block.exercise];

            return {
                id: block.exercise,
                name: exercise?.name ?? block.exercise,
                sets: block.sets,
                target: block.target
            };
        })
    );

    const activities = scheduled.flatMap(({ workout }) =>
        workout.type === "activity" ? workout.options || [] : []
    );

    return {
        restDay: false,
        name: scheduled.map(item => item.workout.name).join(" + "),
        workoutId: scheduled[0].id,
        workoutIds: scheduled.map(item => item.id),
        exercises,
        activities
    };
}

/**
 * Return the complete "today" object.
 *
 * More modules will be added later:
 * - school
 * - nutrition
 * - health
 * - calendar
 * - weather
 * - smart home
 */
async function getToday() {
    const now = new Date();

    let workout;

    try {
        workout = await getTodayWorkout();
    } catch (error) {
        console.error("Anthony Core workout error:", error);

        workout = {
            restDay: false,
            name: "Workout Unavailable",
            workoutId: null,
            exercises: [],
            error: error.message
        };
    }

    return {
        date: getIsoDate(now),
        day: getDayName(now),
        greeting: getGreeting(now),
        workout,

        school: {
            classes: [],
            homework: []
        },

        nutrition: {
            protein: 0,
            proteinGoal: 180,
            waterLiters: 0,
            waterGoalLiters: 4
        },

        health: {
            steps: 0,
            stepGoal: 10000,
            activeCalories: 0,
            sleepHours: null,
            recoveryScore: null
        }
    };
}
function getDailyBriefing(today) {
    const assignmentCount =
        today.school?.homework?.length ?? 0;

    const steps =
        today.health?.steps ?? 0;

    const stepGoal =
        today.health?.stepGoal ?? 10000;

    const activeCalories =
        today.health?.activeCalories ?? 0;

    let status = {
        label: "On Track",
        level: "good"
    };

    if (assignmentCount >= 3) {
        status = {
            label: "Busy Day",
            level: "warning"
        };
    }

    if (assignmentCount >= 5) {
        status = {
            label: "High Priority",
            level: "urgent"
        };
    }

    const focusMessage =
        assignmentCount > 0
            ? `Complete your next assignment and stay ahead of ${assignmentCount} due item${assignmentCount === 1 ? "" : "s"}.`
            : today.workout.restDay
                ? "Use today to recover, hydrate, and prepare for tomorrow."
                : `Complete your ${today.workout.name} workout.`;

    return {
        greeting: today.greeting,

        status,

        focus: {
            title: "Today's Focus",
            message: focusMessage
        },

        quickLook: {
            steps: {
                current: steps,
                goal: stepGoal
            },

            activeCalories: {
                current: activeCalories,
                unit: "kcal"
            },

            homework: {
                dueCount: assignmentCount
            }
        },

        reminder:
            today.workout.restDay
                ? "Recover well today."
                : "Beat your previous performance with good form.",

        quote:
            "Don't count the days. Make the days count."
    };
}
window.AnthonyCore = {
    getGreeting,
    getDayName,
    getIsoDate,
    loadJson,
    getTodayWorkout,
    getToday,
    getDailyBriefing
};