class Information {
  constructor(
    project_name,
    file_name,
    source_name,
    remote_server,
    issue_num,
    compile_option,
    user,
    password,
    auto_yes,
    auto_patch,
    updated_files,
    ignore_files
  ) {
    this.information = {
      file_name: file_name,
      updated_file_name: '',
      file_name_only: file_name.replace(/.*\/|.info/g, ''),
      config: {
        project_name: project_name,
        source_name: source_name,
        remote_server: remote_server,
        issue_num: issue_num,
        compile_option: compile_option,
        user: user,
        password: password,
        auto_yes: auto_yes ? auto_yes : 'n',
        auto_patch: auto_patch ? auto_patch : 'n'
      },
      updated_files: updated_files.join('\n'),
      ignore_files: ignore_files.join('\n')
    };
  }

  isValid() {
    var info = this._information;
    if (
      info.file_name &&
      info.config.source_name &&
      info.config.remote_server &&
      info.config.issue_num &&
      info.config.user &&
      info.config.password
    )
      return true;
    return false;
  }

  getInformation() {
    return this.information;
  }
  setInformation(information) {
    this._information = information;
  }

  getFileName() {
    return this.information.file_name;
  }
  setFileName(file_name) {
    this.information.file_name = file_name;
  }

  getUpdatedFileName() {
    return this.information.updated_file_name;
  }
  setUpdatedFileName(updated_file_name) {
    this.information.updated_file_name = updated_file_name;
  }

  getFileNameOnly() {
    return this.information.file_name_only;
  }
  setFileNameOnly(file_name) {
    this.information.file_name_only = file_name.replace(/.*\/|.info/g, '');
  }

  getProjectName() {
    return this.information.config.project_name;
  }
  setProjectName(project_name) {
    this.information.config.project_name = project_name;
  }

  getSourceName() {
    return this.information.config.source_name;
  }
  setSourceName(source_name) {
    this.information.config.source_name = source_name;
  }

  getRemoteServer() {
    return this.information.config.remote_server;
  }
  setRemoteServer(remote_server) {
    this.information.config.remote_server = remote_server;
  }

  getIssueNum() {
    return this.information.config.issue_num;
  }
  setIssueNum(issue_num) {
    this.information.config.issue_num = issue_num;
  }

  getCompileOption() {
    return this.information.config.compile_option;
  }
  setCompileOption(compile_option) {
    this.information.config.compile_option = compile_option;
  }

  getUser() {
    return this.information.config.user;
  }
  setUser(user) {
    this.information.config.user = user;
  }

  getPassword() {
    return this.information.config.password;
  }
  setPassword(password) {
    this.information.config.password = password;
  }

  getAutoYes() {
    return this.information.config.auto_yes;
  }
  setAutoYes(auto_yes) {
    this.information.config.auto_yes = auto_yes;
  }

  getAutoPatch() {
    return this.information.config.auto_patch;
  }
  setAutoPatch(auto_patch) {
    this.information.config.auto_patch = auto_patch;
  }

  getUpdatedFiles() {
    return this.information.updated_files;
  }
  setUPdatedFiles(updated_files) {
    this.information.updated_files = updated_files;
  }

  getIgnoreFiles() {
    return this.information.ignore_files;
  }
  setIgnoreFiles(ignore_files) {
    this.information.ignore_files = ignore_files;
  }
}
