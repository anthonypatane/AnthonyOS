"use strict";

/*
=========================================
Anthony OS - Workout Storage Service
Version: 1
Purpose:
Store and retrieve completed workouts.
=========================================
*/

const STORAGE_KEY = "anthonyOSWorkoutHistory";

/**
 * Return every saved workout.
 */
function getWorkoutHistory() {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
        return [];
    }

    try {
        return JSON.parse(saved);
    } catch (error) {
        console.error("Workout history is corrupted.", error);
        return [];
    }
}

/**
 * Save one completed workout.
 */
function saveWorkout(workout) {
    const history = getWorkoutHistory();

    history.push(workout);

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(history)
    );
}

/**
 * Remove all saved workouts.
 * (Useful while we're testing.)
 */
function clearWorkoutHistory() {
    localStorage.removeItem(STORAGE_KEY);
}

window.WorkoutStorage = {
    getWorkoutHistory,
    saveWorkout,
    clearWorkoutHistory
};