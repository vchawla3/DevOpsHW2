## HW 2 Test Generation

The goal of this home work was to achieve full branch and statement coverage using automatic test generation to create tests by analyzing/parsing the code beforehand.

### Screenshots of Coverage

![Coverage Report](/fullCoverageReport.png?raw=true)

![Console Coverage](/consoleCoverage.png?raw=true)

##### Getting a simple coverage report

You can run the local version as follows:

    node_modules/.bin/istanbul cover test.js
    node_modules\.bin\istanbul cover test.js (Windows)

##### See a fully annotated html report here:
    
    open coverage/lcov-report/TestGeneration/subject.js.html
    start coverage/lcov-report/TestGeneration/subject.js.html (Windows)