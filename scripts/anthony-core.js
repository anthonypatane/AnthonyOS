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
    const response = await fetch(path, {
        cache: "no-store"
    });

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
 * Return scheduled and online classes for the current day.
 */
async function getTodayClasses(day = getDayName()) {
    const school = await loadJson(
        "../../data/school/classes.json"
    );

    const classes = school.classes || [];
    const scheduled = [];

    classes.forEach(course => {
        (course.meetings || []).forEach(meeting => {
            if (meeting.days?.includes(day)) {
                scheduled.push({
                    id: course.id,
                    code: course.code,
                    name: course.name,
                    format: course.format,
                    start: meeting.start,
                    end: meeting.end,
                    location: meeting.location
                });
            }
        });
    });

    scheduled.sort((a, b) => a.start.localeCompare(b.start));

    return {
        semester: school.semester,
        scheduled,
        online: classes.filter(course => course.format === "online")
    };
}

/**
 * Return open assignments due during the next seven days.
 */
async function getUpcomingAssignments(now = new Date(), daysAhead = 7) {
    const school = await loadJson(
        "../../data/school/assignments.json"
    );
    const cutoff = new Date(now);

    cutoff.setDate(cutoff.getDate() + daysAhead);

    return (school.assignments || [])
        .filter(assignment => assignment.status === "open")
        .filter(assignment => {
            const due = new Date(assignment.due);

            return due >= now && due <= cutoff;
        })
        .sort((a, b) => new Date(a.due) - new Date(b.due));
}

/**
 * Return every assignment due today or during the next seven days.
 * Completed assignments remain visible so the dashboard can show their status.
 */
async function getAssignmentOverview(now = new Date(), daysAhead = 7) {
    const school = await loadJson(
        "../../data/school/assignments.json"
    );
    const startOfToday = new Date(now);
    const endOfToday = new Date(now);
    const cutoff = new Date(now);

    startOfToday.setHours(0, 0, 0, 0);
    endOfToday.setHours(23, 59, 59, 999);
    cutoff.setDate(cutoff.getDate() + daysAhead);
    cutoff.setHours(23, 59, 59, 999);

    const allAssignments = (school.assignments || [])
        .slice()
        .sort((a, b) => new Date(a.due) - new Date(b.due));
    const assignments = allAssignments
        .filter(assignment => {
            const due = new Date(assignment.due);

            return due >= startOfToday && due <= cutoff;
        })
        .sort((a, b) => new Date(a.due) - new Date(b.due));

    const courseSummary = Object.values(allAssignments.reduce((summary, assignment) => {
        if (!summary[assignment.course]) {
            summary[assignment.course] = {
                course: assignment.course,
                completed: 0,
                remaining: 0
            };
        }

        if (assignment.status === "completed") {
            summary[assignment.course].completed += 1;
        } else {
            summary[assignment.course].remaining += 1;
        }

        return summary;
    }, {})).sort((a, b) => a.course.localeCompare(b.course));

    return {
        courseSummary,
        overdue: allAssignments.filter(assignment =>
            assignment.status !== "completed" && new Date(assignment.due) < startOfToday
        ),
        dueToday: assignments.filter(assignment =>
            new Date(assignment.due) <= endOfToday
        ),
        upcoming: assignments.filter(assignment =>
            new Date(assignment.due) > endOfToday
        ),
        recentCompleted: allAssignments
            .filter(assignment => assignment.status === "completed")
            .sort((a, b) => new Date(b.due) - new Date(a.due))
            .slice(0, 8)
    };
}

/**
 * Return the newest health record imported from Apple Health.
 */
async function getLatestHealth() {
    const health = await loadJson(
        "../../data/health/latest.json"
    );

    return {
        source: health.source,
        lastUpdated: health.lastUpdated,
        sleep: health.sleep || {},
        activity: health.activity || {}
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
    let classes;
    let homework;
    let assignmentOverview;
    let importedHealth;

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

    try {
        homework = await getUpcomingAssignments(now);
    } catch (error) {
        console.error("Anthony Core assignment error:", error);
        homework = [];
    }

    try {
        assignmentOverview = await getAssignmentOverview(now);
    } catch (error) {
        console.error("Anthony Core assignment overview error:", error);
        assignmentOverview = {
            courseSummary: [],
            overdue: [],
            dueToday: [],
            upcoming: [],
            recentCompleted: []
        };
    }

    try {
        classes = await getTodayClasses(getDayName(now));
    } catch (error) {
        console.error("Anthony Core school error:", error);

        classes = {
            semester: null,
            scheduled: [],
            online: [],
            error: error.message
        };
    }

    try {
        importedHealth = await getLatestHealth();
    } catch (error) {
        console.error("Anthony Core health import error:", error);
        importedHealth = {
            source: "apple-health",
            lastUpdated: null,
            sleep: {},
            activity: {}
        };
    }

    return {
        date: getIsoDate(now),
        day: getDayName(now),
        greeting: getGreeting(now),
        workout,

        school: {
            classes: classes.scheduled,
            onlineClasses: classes.online,
            semester: classes.semester,
            homework,
            assignmentOverview
        },

        nutrition: {
            protein: 0,
            proteinGoal: 180,
            waterLiters: 0,
            waterGoalLiters: 4
        },

        health: {
            steps: importedHealth.activity.steps ?? 0,
            stepGoal: 10000,
            activeCalories: importedHealth.activity.activeCalories ?? 0,
            sleepHours: importedHealth.sleep.totalHours ?? null,
            sleep: importedHealth.sleep,
            source: importedHealth.source,
            lastUpdated: importedHealth.lastUpdated,
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
        }
    };
}
window.AnthonyCore = {
    getGreeting,
    getDayName,
    getIsoDate,
    loadJson,
    getTodayWorkout,
    getTodayClasses,
    getUpcomingAssignments,
    getAssignmentOverview,
    getLatestHealth,
    getToday,
    getDailyBriefing
};
