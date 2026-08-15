import ExcelJS from "exceljs";

async function dump(path: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  console.log("=== FILE:", path, "===");
  wb.eachSheet((sheet) => {
    console.log("--- sheet:", sheet.name, "---");
    sheet.eachRow((row) => {
      console.log(JSON.stringify(row.values));
    });
  });
}

async function main() {
  const scratch = process.argv[2];
  await dump(`${scratch}/individual-report.xlsx`);
  await dump(`${scratch}/team-overview.xlsx`);
}

main();
