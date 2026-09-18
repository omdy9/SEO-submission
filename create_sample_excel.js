const ExcelJS = require('exceljs');

async function createSample() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tasks');

  sheet.columns = [
    { header: 'Keyword', key: 'keyword', width: 30 },
    { header: 'Type of Content', key: 'contentType', width: 20 },
    { header: 'Site on which content is to be submitted', key: 'targetSite', width: 40 },
  ];

  sheet.addRow({
    keyword: 'DGFT Consultant in Ludhiana',
    contentType: 'Bookmarking',
    targetSite: 'https://example.com',
  });

  sheet.addRow({
    keyword: 'DGFT Consultant in Gurgaon',
    contentType: 'Bookmarking',
    targetSite: 'https://example.com',
  });

  sheet.addRow({
    keyword: 'DGFT Consultant in Bangalore',
    contentType: 'Classifieds',
    targetSite: 'https://example.com',
  });

  sheet.addRow({
    keyword: 'DGFT Consultant in Hyderabad',
    contentType: 'Blogs',
    targetSite: 'https://example.com',
  });

  sheet.addRow({
    keyword: 'DGFT Consultant in Pune',
    contentType: 'Articles',
    targetSite: 'https://example.com',
  });

  await workbook.xlsx.writeFile('sample_tasks.xlsx');
  console.log('Sample Excel file sample_tasks.xlsx created successfully!');
}

createSample();
