npm init -y
npm install --save-dev typescript
npx tsc --init
npm install --save-dev jest @types/jest ts-jest
npx ts-jest config:init
mkdir src
mkdir test
echo -e "node_modules/\ndist/\ncoverage/" > .gitignore