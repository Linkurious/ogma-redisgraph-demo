[[ -f .process ]] && kill -9 `cat .process` || echo 'killed';
npm i;
# disown to stop waiting for it and close the ssh channel
npm run server -- --auth &>/dev/null &disown;
