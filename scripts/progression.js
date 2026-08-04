"use strict";

function getLastEntry(log, exerciseId) {
    const entries = log.filter(entry => entry.exercise === exerciseId);

    if (entries.length === 0) {
        return null;
    }

    return entries.sort((a, b) =>
        a.date.localeCompare(b.date)
    )[entries.length - 1];
}

function getTopSet(entry) {
    if (!entry || !Array.isArray(entry.sets)) {
        return null;
    }

    return entry.sets.reduce((best, current) => {
        if (!best) {
            return current;
        }

        if (current.weight > best.weight) {
            return current;
        }

        if (
            current.weight === best.weight &&
            current.reps > best.reps
        ) {
            return current;
        }

        return best;
    }, null);
}

function getNextGoal(program, exerciseId, target) {
    const entry = getLastEntry(program.log, exerciseId);
    const topSet = getTopSet(entry);

    if (!topSet) {
        return {
            action: "establish_baseline",
            label: `Find a working weight for ${target.min}-${target.max} reps`
        };
    }

    const exercise = program.exercises[exerciseId];
    const equipment = exercise.equipment;
    const step =
        program.progression.increments[equipment] ??
        program.progression.increments.default;

    if (topSet.reps >= target.max) {
        return {
            action: "increase_weight",
            weight: topSet.weight + step,
            reps: target.min,
            label: `${topSet.weight + step} lb × ${target.min}`
        };
    }

    if (topSet.reps < target.min) {
        return {
            action: "reduce_weight",
            weight: Math.max(0, topSet.weight - step),
            reps: target.min,
            label: `${Math.max(0, topSet.weight - step)} lb × ${target.min}`
        };
    }

    return {
        action: "add_rep",
        weight: topSet.weight,
        reps: topSet.reps + 1,
        label: `${topSet.weight} lb × ${topSet.reps + 1}`
    };
}

window.Progression = {
    getLastEntry,
    getTopSet,
    getNextGoal
};