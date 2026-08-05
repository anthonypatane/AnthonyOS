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

    const workoutId = workoutIds[0];
    const workout = program.workouts?.[workoutId];

    if (!workout) {
        return {
            restDay: false,
            name: "Workout Unavailable",
            workoutId,
            exercises: [],
            error: `Workout "${workoutId}" was not found.`
        };
    }

    const exercises = (workout.blocks || []).map(block => {
        const exercise = program.exercises?.[block.exercise];

        return {
            id: block.exercise,
            name: exercise?.name ?? block.exercise,
            sets: block.sets,
            target: block.target
        };
    });

    return {
        restDay: false,
        name: workout.name,
        workoutId,
        exercises
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
            sleepHours: null,
            recoveryScore: null
        }
    };
}

window.AnthonyCore = {
    getGreeting,
    getDayName,
    getIsoDate,
    loadJson,
    getTodayWorkout,
    getToday
};