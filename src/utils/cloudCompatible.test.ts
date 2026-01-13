import { normalizeFileToCSV } from './cloudCompatible';

// Test cases for normalizeFileToCSV function
console.log('Testing normalizeFileToCSV function:\n');

// Test 1: Excel .xlsx file
const test1 = normalizeFileToCSV('empdata - Copy.xlsx');
console.log(`Input: "empdata - Copy.xlsx"`);
console.log(`Output: "${test1}"`);
console.log(`Expected: "empdata - Copy.csv"`);
console.log(`✓ Pass: ${test1 === 'empdata - Copy.csv'}\n`);

// Test 2: Excel .xls file
const test2 = normalizeFileToCSV('employee_data.xls');
console.log(`Input: "employee_data.xls"`);
console.log(`Output: "${test2}"`);
console.log(`Expected: "employee_data.csv"`);
console.log(`✓ Pass: ${test2 === 'employee_data.csv'}\n`);

// Test 3: Already CSV file
const test3 = normalizeFileToCSV('data.csv');
console.log(`Input: "data.csv"`);
console.log(`Output: "${test3}"`);
console.log(`Expected: "data.csv"`);
console.log(`✓ Pass: ${test3 === 'data.csv'}\n`);

// Test 4: Case insensitive .XLSX
const test4 = normalizeFileToCSV('Report.XLSX');
console.log(`Input: "Report.XLSX"`);
console.log(`Output: "${test4}"`);
console.log(`Expected: "Report.csv"`);
console.log(`✓ Pass: ${test4 === 'Report.csv'}\n`);

// Test 5: File with underscores
const test5 = normalizeFileToCSV('empdata_copy.xlsx');
console.log(`Input: "empdata_copy.xlsx"`);
console.log(`Output: "${test5}"`);
console.log(`Expected: "empdata_copy.csv"`);
console.log(`✓ Pass: ${test5 === 'empdata_copy.csv'}\n`);
