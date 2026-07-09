// Timetable Database - SSCBS Even Semester 2025-26
// Covers BMS (16 sections), BBA FIA (8 sections), and BSc Comp Sci (4 sections)

// Real subjects for each course
const COURSE_SUBJECTS = {
  BMS: {
    2: [
      { name: "Principles of Marketing", code: "Core" },
      { name: "Macro Economics", code: "Core" },
      { name: "Cost and Management Accounting", code: "Core" },
      { name: "GE - Entrepreneurship Essentials 2", code: "GE" },
      { name: "SEC - Advanced Spreadsheet Tools", code: "SEC" },
      { name: "VAC - Emotional Intelligence", code: "VAC" },
      { name: "AEC - Hindi", code: "AEC" }
    ],
    4: [
      { name: "Quantitative Techniques for Management", code: "Core" },
      { name: "Financial Management", code: "Core" },
      { name: "Human Resource Management", code: "Core" },
      { name: "DSE - Brand Management", code: "DSE" },
      { name: "SEC - Financial Database Analysis", code: "SEC" },
      { name: "VAC - Science and Society", code: "VAC" },
      { name: "AEC - EVS II", code: "AEC" }
    ],
    6: [
      { name: "Business Strategies", code: "Core" },
      { name: "Financial Institutions & Markets", code: "Core" },
      { name: "Operations Management", code: "Core" },
      { name: "DSE - Research Methodology", code: "DSE" },
      { name: "GE - Social Entrepreneurship & Innovation", code: "GE" },
      { name: "SEC - App Development using Flutter", code: "SEC" }
    ],
    8: [
      { name: "Management Information System", code: "Core" },
      { name: "DSE - International Marketing", code: "DSE" },
      { name: "GE - Fundraising & Management", code: "GE" },
      { name: "SEC - Dissertation / Academic Project", code: "SEC" }
    ]
  },
  "BBA FIA": {
    2: [
      { name: "Cost and Management Accounting", code: "Core" },
      { name: "Macro Economics", code: "Core" },
      { name: "Quantitative Techniques", code: "Core" },
      { name: "GE - Entrepreneurship Essentials 2", code: "GE" },
      { name: "SEC - Advanced Spreadsheet Tools", code: "SEC" },
      { name: "VAC - Emotional Intelligence", code: "VAC" },
      { name: "AEC - Hindi", code: "AEC" }
    ],
    4: [
      { name: "Basics of Econometrics", code: "Core" },
      { name: "Investment Analysis & Portfolio Management", code: "Core" },
      { name: "Income Tax Law & Practice", code: "Core" },
      { name: "DSE - Corporate Analysis & Valuation", code: "DSE" },
      { name: "SEC - Personality Development & Comm", code: "SEC" },
      { name: "VAC - Science and Society", code: "VAC" }
    ],
    6: [
      { name: "International Finance", code: "Core" },
      { name: "Corporate Ethics", code: "Core" },
      { name: "Financial Services", code: "Core" },
      { name: "DSE - Strategic Corporate Finance", code: "DSE" },
      { name: "GE - Social Entrepreneurship & Innovation", code: "GE" },
      { name: "SEC - App Development using Flutter", code: "SEC" }
    ],
    8: [
      { name: "Fixed Income Securities", code: "Core" },
      { name: "DSE - Entrepreneurial Finance", code: "DSE" },
      { name: "DSE - Environmental Finance", code: "DSE" },
      { name: "GE - Fundraising & Management", code: "GE" },
      { name: "SEC - Academic Project", code: "SEC" }
    ]
  },
  "Bsc Comp Sci": {
    2: [
      { name: "Data Structures", code: "Core" },
      { name: "Discrete Mathematical Structures", code: "Core" },
      { name: "Computer System Architecture", code: "Core" },
      { name: "GE - Numerical Methods", code: "GE" },
      { name: "SEC - Web Design and Development", code: "SEC" },
      { name: "VAC - Digital Empowerment", code: "VAC" }
    ],
    4: [
      { name: "Design & Analysis of Algorithms", code: "Core" },
      { name: "Database Management Systems", code: "Core" },
      { name: "Computer Networks", code: "Core" },
      { name: "DSE - Artificial Intelligence", code: "DSE" },
      { name: "SEC - Programming with Python", code: "SEC" },
      { name: "VAC - Cyber Security", code: "VAC" }
    ],
    6: [
      { name: "Software Engineering", code: "Core" },
      { name: "Operating Systems", code: "Core" },
      { name: "Theory of Computation", code: "Core" },
      { name: "DSE - Machine Learning", code: "DSE" },
      { name: "GE - Data Science using R", code: "GE" }
    ],
    8: [
      { name: "Information Security", code: "Core" },
      { name: "DSE - Cloud Computing", code: "DSE" },
      { name: "DSE - Internet of Things (IoT)", code: "DSE" },
      { name: "SEC - Capstone Project", code: "SEC" }
    ]
  }
};

const PERIODS = [
  { id: 1, label: "Period I", start: "09:00", end: "10:00", startLabel: "9:00 AM", endLabel: "10:00 AM" },
  { id: 2, label: "Period II", start: "10:00", end: "11:00", startLabel: "10:00 AM", endLabel: "11:00 AM" },
  { id: 3, label: "Period III", start: "11:00", end: "12:00", startLabel: "11:00 AM", endLabel: "12:00 PM" },
  { id: 0, label: "Infinity Hour", start: "12:00", end: "13:00", startLabel: "12:00 PM", endLabel: "1:00 PM", isBreak: true },
  { id: 4, label: "Period IV", start: "13:00", end: "14:00", startLabel: "1:00 PM", endLabel: "2:00 PM" },
  { id: 5, label: "Period V", start: "14:00", end: "15:00", startLabel: "2:00 PM", endLabel: "3:00 PM" },
  { id: 6, label: "Period VI", start: "15:00", end: "16:00", startLabel: "3:00 PM", endLabel: "4:00 PM" },
  { id: 7, label: "Period VII", start: "16:00", end: "17:00", startLabel: "4:00 PM", endLabel: "5:00 PM" }
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// Specific hand-crafted schedule for BMS 2A
const BMS_2A_SCHEDULE = {
  Monday: [
    { period: 1, subject: "Principles of Marketing", teacher: "Dr. Raj Kumar", room: "Room 703" },
    { period: 2, subject: "Macro Economics", teacher: "Ms. Krishnaveni", room: "Room 703" },
    { period: 3, subject: "Principles of Marketing / Cost Accounting (G2)", teacher: "Dr. Shalini Prakash / Dr. Paridhi", room: "Room 236" },
    { period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" },
    { period: 4, subject: "Quantitative Techniques", teacher: "Dr. Anuja Mathur", room: "Room 703" },
    { period: 5, subject: "SEC - Advanced Spreadsheet Tools", teacher: "Dr. Shalini Prakash", room: "Room 703" },
    { period: 6, subject: "AEC - Hindi B", teacher: "Dr. Pooja Singh", room: "Room 703" },
    { period: 7, subject: "AEC - Hindi B", teacher: "Dr. Pooja Singh", room: "Room 703" }
  ],
  Tuesday: [
    { period: 1, subject: "Cost and Management Accounting", teacher: "Ms. Kishori Ravi Shankar", room: "Room 703" },
    { period: 2, subject: "Macro Economics", teacher: "Ms. Krishnaveni", room: "Room 703" },
    { period: 3, subject: "Quantitative Techniques", teacher: "Dr. Anuja Mathur", room: "Room 703" },
    { period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" },
    { period: 4, subject: "Principles of Marketing", teacher: "Dr. Raj Kumar", room: "Room 703" },
    { period: 5, subject: "Principles of Marketing", teacher: "Dr. Raj Kumar", room: "Room 703" },
    { period: 6, subject: "Free / Study Slot", teacher: "-", room: "-" },
    { period: 7, subject: "Free / Study Slot", teacher: "-", room: "-" }
  ],
  Wednesday: [
    { period: 1, subject: "Macro Economics", teacher: "Ms. Krishnaveni", room: "Room 703" },
    { period: 2, subject: "Cost and Management Accounting", teacher: "Dr. Paridhi", room: "Room 703" },
    { period: 3, subject: "Macro Economics", teacher: "Ms. Krishnaveni", room: "Room 703" },
    { period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" },
    { period: 4, subject: "Quantitative Techniques", teacher: "Dr. Anuja Mathur", room: "Room 703" },
    { period: 5, subject: "SEC - Advanced Spreadsheet Tools", teacher: "Dr. Shalini Prakash", room: "Room 703" },
    { period: 6, subject: "AEC - Hindi A / Hindi C / Hindi D", teacher: "Dr. Pooja Singh / Mr. Dinesh / Dr. Puja Gupta", room: "Room 703" },
    { period: 7, subject: "AEC - Hindi A / Hindi C / Hindi D", teacher: "Dr. Pooja Singh / Mr. Dinesh / Dr. Puja Gupta", room: "Room 703" }
  ],
  Thursday: [
    { period: 1, subject: "GE - Entrepreneurship Essentials 2", teacher: "Dr. Shalini Prakash (Unsupervised)", room: "Room 703" },
    { period: 2, subject: "Cost and Management Accounting", teacher: "Dr. Paridhi", room: "Room 703" },
    { period: 3, subject: "Macro Economics", teacher: "Ms. Krishnaveni", room: "Room 703" },
    { period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" },
    { period: 4, subject: "Cost Accounting Lab (G1) / Spreadsheet Lab (G2)", teacher: "Dr. Paridhi / Dr. Shalini Prakash", room: "Room 236" },
    { period: 5, subject: "Quantitative Techniques Lab (G1)", teacher: "Dr. Anuja Mathur", room: "Room 703" },
    { period: 6, subject: "Free / Study Slot", teacher: "-", room: "-" },
    { period: 7, subject: "Free / Study Slot", teacher: "-", room: "-" }
  ],
  Friday: [
    { period: 1, subject: "Cost and Management Accounting", teacher: "Ms. Kishori Ravi Shankar", room: "Room 703" },
    { period: 2, subject: "Cost and Management Accounting", teacher: "Dr. Paridhi", room: "Room 703" },
    { period: 3, subject: "Principles of Marketing", teacher: "Dr. Raj Kumar", room: "Room 703" },
    { period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" },
    { period: 4, subject: "VAC - Emotional Intelligence (Unsupervised)", teacher: "Ms. Kishori Ravi Shankar", room: "Room 703" },
    { period: 5, subject: "SEC - Advanced Spreadsheet Tools", teacher: "Dr. Shalini Prakash", room: "Room 703" },
    { period: 6, subject: "Quantitative Techniques Lab (G2)", teacher: "Dr. Anuja Mathur", room: "Room 703" },
    { period: 7, subject: "Free / Study Slot", teacher: "-", room: "-" }
  ]
};

// Hand-crafted schedule for BBA FIA 2A
const BBA_FIA_2A_SCHEDULE = {
  Monday: [
    { period: 1, subject: "Principles of Marketing", teacher: "Dr. Vinayak Gautam", room: "Room 203" },
    { period: 2, subject: "Principles of Marketing", teacher: "Dr. Vinayak Gautam", room: "Room 203" },
    { period: 3, subject: "Quantitative Techniques", teacher: "Dr. Rishi Rajan Sahay", room: "Room 203" },
    { period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" },
    { period: 4, subject: "Quantitative Techniques Lab (G2)", teacher: "Dr. Rishi Rajan Sahay", room: "Room 203" },
    { period: 5, subject: "GE - Entrepreneurship Essentials 2", teacher: "Dr. Shalini Prakash", room: "Room 203" },
    { period: 6, subject: "Free / Study Slot", teacher: "-", room: "-" },
    { period: 7, subject: "AEC - Hindi B", teacher: "Prof. Poonam Verma", room: "Room 203" }
  ],
  Tuesday: [
    { period: 1, subject: "GE - Entrepreneurship Essentials 2 (Unsupervised)", teacher: "Dr. Shalini Prakash", room: "Room 203" },
    { period: 2, subject: "Cost and Management Accounting", teacher: "Dr. Paridhi", room: "Room 203" },
    { period: 3, subject: "Cost Accounting Lab (G1) / Spreadsheet Lab (G2)", teacher: "Dr. Paridhi / Dr. Shalini Prakash", room: "Room 236" },
    { period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" },
    { period: 4, subject: "SEC - Advanced Spreadsheet Tools Lab", teacher: "Mr. Vineet / Dr Deepali Dhaka", room: "Room 203" },
    { period: 5, subject: "Quantitative Techniques Lab (G1)", teacher: "Dr. Rishi Rajan Sahay", room: "Room 203" },
    { period: 6, subject: "Principles of Marketing", teacher: "Dr. Vinayak Gautam", room: "Room 203" },
    { period: 7, subject: "Free / Study Slot", teacher: "-", room: "-" }
  ],
  Wednesday: [
    { period: 1, subject: "SEC - Advanced Spreadsheet Tools Lab", teacher: "Mr. Vineet / Dr Deepali Dhaka", room: "Room 203" },
    { period: 2, subject: "SEC - Advanced Spreadsheet Tools Lab", teacher: "Mr. Vineet / Dr Deepali Dhaka", room: "Room 203" },
    { period: 3, subject: "Cost and Management Accounting", teacher: "Dr. Paridhi", room: "Room 203" },
    { period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" },
    { period: 4, subject: "Spreadsheet Lab (G1) / Cost Accounting Lab (G2)", teacher: "Dr. Shalini Prakash / Dr. Paridhi", room: "Room 236" },
    { period: 5, subject: "Quantitative Techniques", teacher: "Dr. Rishi Rajan Sahay", room: "Room 203" },
    { period: 6, subject: "AEC - Hindi C", teacher: "Mr. Dinesh", room: "Room 203" },
    { period: 7, subject: "AEC - Hindi C", teacher: "Mr. Dinesh", room: "Room 203" }
  ],
  Thursday: [
    { period: 1, subject: "AEC - Hindi B", teacher: "Mr. Dinesh", room: "Room 203" },
    { period: 2, subject: "Cost and Management Accounting", teacher: "Ms. Kishori Ravi Shankar", room: "Room 203" },
    { period: 3, subject: "SEC - Advanced Spreadsheet Tools", teacher: "Dr. Shalini Prakash", room: "Room 203" },
    { period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" },
    { period: 4, subject: "Quantitative Techniques", teacher: "Dr. Rishi Rajan Sahay", room: "Room 203" },
    { period: 5, subject: "SEC - Advanced Spreadsheet Tools", teacher: "Dr. Shalini Prakash", room: "Room 203" },
    { period: 6, subject: "Free / Study Slot", teacher: "-", room: "-" },
    { period: 7, subject: "Free / Study Slot", teacher: "-", room: "-" }
  ],
  Friday: [
    { period: 1, subject: "AEC - Hindi B", teacher: "Mr. Dinesh", room: "Room 203" },
    { period: 2, subject: "Cost and Management Accounting", teacher: "Ms. Kishori Ravi Shankar", room: "Room 203" },
    { period: 3, subject: "SEC - Advanced Spreadsheet Tools", teacher: "Dr. Shalini Prakash", room: "Room 203" },
    { period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" },
    { period: 4, subject: "Cost and Management Accounting", teacher: "Dr. Paridhi", room: "Room 203" },
    { period: 5, subject: "SEC - Advanced Spreadsheet Tools Lab", teacher: "Mr. Vineet / Dr Deepali Dhaka", room: "Room 203" },
    { period: 6, subject: "Principles of Marketing", teacher: "Dr. Vinayak Gautam", room: "Room 203" },
    { period: 7, subject: "Principles of Marketing", teacher: "Dr. Vinayak Gautam", room: "Room 203" }
  ]
};

// Generates dynamic but extremely realistic tables for any given section
export function getTimetable(course, semester, section) {
  // If requesting BMS 2A, return the hand-crafted one
  if (course === "BMS" && semester === "2" && section === "A") {
    return BMS_2A_SCHEDULE;
  }
  // If requesting BBA FIA 2A, return the hand-crafted one
  if (course === "BBA FIA" && semester === "2" && section === "A") {
    return BBA_FIA_2A_SCHEDULE;
  }

  // Generate deterministic schedule for other sections based on course subjects
  const subjects = COURSE_SUBJECTS[course]?.[semester] || COURSE_SUBJECTS["BMS"]["2"];
  const generatedSchedule = {};

  // Simple hashing/scrambling helper to make schedules look natural and distinct
  const hashCode = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const seed = hashCode(`${course}-${semester}-${section}`);
  const rooms = {
    "BMS": ["503", "507", "703", "707", "733", "737", "303", "307", "361", "257", "523"],
    "BBA FIA": ["203", "253", "553", "557", "603", "607", "533"],
    "Bsc Comp Sci": ["651", "644", "326", "237"]
  };
  
  const courseRooms = rooms[course] || ["703"];
  const roomIndex = seed % courseRooms.length;
  const mainRoom = `Room ${courseRooms[roomIndex]}`;

  const teachers = ["Dr. Paridhi", "Dr. Shalini Prakash (SP)", "Dr. Rishi Rajan Sahay (RRS)", "Dr. Vinayak Gautam", "Dr. Anuja Mathur", "Dr. Satish Kumar Goel", "Mr. Dinesh", "Ms. Kajol", "Ms. Bharti", "Dr. Saumya Jain", "Dr. Sushmita", "Dr. Amit Kumar", "Mr. Prakhar", "Dr. Neeraj Kumar"];

  DAYS.forEach((day, dIdx) => {
    const dayClasses = [];
    
    PERIODS.forEach((period) => {
      if (period.isBreak) {
        dayClasses.push({ period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" });
        return;
      }

      // Determine class scheduling: some periods are study slots (free) to make it realistic
      const classSeed = seed + dIdx * 7 + period.id;
      const isFree = (classSeed % 6 === 0) && (period.id > 5 || period.id === 1);
      
      if (isFree) {
        dayClasses.push({ period: period.id, subject: "Free / Study Slot", teacher: "-", room: "-" });
      } else {
        const subIndex = (classSeed) % subjects.length;
        const teachIndex = (classSeed + 3) % teachers.length;
        const subjectObj = subjects[subIndex];
        
        let displaySubject = subjectObj.name;
        let displayRoom = mainRoom;
        
        // Add Lab variations
        if (subjectObj.code === "SEC" && period.id >= 4 && (classSeed % 2 === 0)) {
          displaySubject += " Lab (Practical)";
          displayRoom = `Lab ${courseRooms[(roomIndex + 1) % courseRooms.length]}`;
        }

        dayClasses.push({
          period: period.id,
          subject: displaySubject,
          teacher: teachers[teachIndex],
          room: displayRoom
        });
      }
    });

    generatedSchedule[day] = dayClasses;
  });

  return generatedSchedule;
}

export { PERIODS, DAYS };
