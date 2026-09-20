// OPE, Out Past Engineering. The Mac app.
//
// A window with a web view in it. The interface is the web folder bundled
// inside the app, served on ope://app/ so it never needs the internet. The
// interface asks this file for everything it cannot do itself: opening a folder,
// reading and writing files, running git, copying to the clipboard, and hearing
// when files on disk change.
//
// Every command here has a twin in scripts/dev-server.mjs. Change one, change
// the other.
import Cocoa
import WebKit
import Darwin
import CoreServices
import Vision
import UniformTypeIdentifiers
#if arch(arm64) && canImport(FoundationModels)
import FoundationModels
#endif

let SCHEME = "ope"
let HOME = URL(string: "ope://app/index.html")!

// ---------------------------------------------------------------- the project

final class Project {
  var root: URL?
  private var stream: FSEventStreamRef?
  var onChange: (([String]) -> Void)?

  static let gitOK: Set<String> = ["for-each-ref", "log", "diff", "blame", "rev-list", "rev-parse", "ls-files",
                                   "status", "init", "add", "commit", "tag", "show"]
  static let skip: Set<String> = [".git", "node_modules", ".next", "dist", "build", ".build", "DerivedData",
                                  ".venv", "venv", "__pycache__", ".cache", "Pods", ".turbo", ".wrangler", "coverage"]

  /* the path the disk itself uses. URL's own resolver turns /private/tmp back
     into /tmp, and file events report /private/tmp, so they never matched */
  static func real(_ path: String) -> String {
    guard let c = realpath(path, nil) else { return (path as NSString).standardizingPath }
    defer { free(c) }
    return String(cString: c)
  }

  var recent: [String] {
    get { UserDefaults.standard.stringArray(forKey: "recent") ?? [] }
    set { UserDefaults.standard.set(Array(newValue.prefix(8)), forKey: "recent") }
  }

  /* the library of project folders, kept in this Mac's own settings, never in the app */
  var library: [[String: Any]] {
    get { (UserDefaults.standard.array(forKey: "library") as? [[String: Any]]) ?? [] }
    set { UserDefaults.standard.set(newValue, forKey: "library") }
  }

  func open(_ path: String) throws -> String {
    let expanded = (path as NSString).expandingTildeInPath
    var isDir: ObjCBool = false
    guard FileManager.default.fileExists(atPath: expanded, isDirectory: &isDir), isDir.boolValue else {
      throw OPEError("That folder does not exist.")
    }
    /* the real path, symlinks resolved, because that is what file events report */
    let url = URL(fileURLWithPath: Project.real(expanded))
    root = url
    var r = recent.filter { $0 != url.path }
    r.insert(url.path, at: 0)
    recent = r
    UserDefaults.standard.set(url.path, forKey: "last")
    if !library.contains(where: { ($0["path"] as? String) == url.path }) {
      library = library + [["path": url.path, "name": url.lastPathComponent]]
    }
    watch()
    return url.path
  }

  /* a path from the interface, and only ever inside the project */
  func inside(_ rel: String) throws -> URL {
    guard let root = root else { throw OPEError("No project is open.") }
    let full = URL(fileURLWithPath: Project.real(root.appendingPathComponent(rel).standardizedFileURL.path))
    guard full.path == root.path || full.path.hasPrefix(root.path + "/") else {
      throw OPEError("That path is outside the project.")
    }
    return full
  }

  func git(_ args: [String]) -> [String: Any] {
    guard let root = root else { return ["code": 1, "out": "", "err": "no project"] }
    guard let first = args.first, Project.gitOK.contains(first) else { return ["code": 1, "out": "", "err": "not allowed"] }
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/usr/bin/git")
    p.arguments = ["-C", root.path] + args
    var env = ProcessInfo.processInfo.environment
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GIT_PAGER"] = "cat"
    p.environment = env
    let out = Pipe(), err = Pipe()
    p.standardOutput = out
    p.standardError = err
    var outData = Data(), errData = Data()
    let group = DispatchGroup()
    group.enter(); DispatchQueue.global().async { outData = out.fileHandleForReading.readDataToEndOfFile(); group.leave() }
    group.enter(); DispatchQueue.global().async { errData = err.fileHandleForReading.readDataToEndOfFile(); group.leave() }
    do { try p.run() } catch { return ["code": 1, "out": "", "err": "git is not installed. Run xcode-select --install in Terminal."] }
    p.waitUntilExit()
    group.wait()
    return ["code": Int(p.terminationStatus),
            "out": String(decoding: outData, as: UTF8.self),
            "err": String(decoding: errData, as: UTF8.self)]
  }

  func list() -> [String] {
    guard let root = root else { return [] }
    var out: [String] = []
    let keys: [URLResourceKey] = [.isDirectoryKey, .isRegularFileKey]
    guard let e = FileManager.default.enumerator(at: root, includingPropertiesForKeys: keys,
                                                 options: [], errorHandler: nil) else { return [] }
    for case let url as URL in e {
      if out.count > 20000 { break }
      let name = url.lastPathComponent
      let vals = try? url.resourceValues(forKeys: Set(keys))
      if vals?.isDirectory == true {
        if Project.skip.contains(name) { e.skipDescendants() }
        continue
      }
      if name == ".DS_Store" || vals?.isRegularFile != true { continue }
      let p = url.standardizedFileURL.path
      if p.hasPrefix(root.path + "/") { out.append(String(p.dropFirst(root.path.count + 1))) }
    }
    return out.sorted()
  }

  func read(_ rel: String) throws -> [String: Any] {
    let url = try inside(rel)
    let size = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? 0
    if size > 2 * 1024 * 1024 { return ["tooBig": true, "size": size] }
    guard let data = try? Data(contentsOf: url) else { throw OPEError("That file could not be read.") }
    if data.prefix(8000).contains(0) { return ["binary": true, "size": size] }
    return ["text": String(decoding: data, as: UTF8.self), "size": size]
  }

  func write(_ rel: String, _ text: String) throws {
    let url = try inside(rel)
    try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    do { try text.write(to: url, atomically: true, encoding: .utf8) }
    catch { throw OPEError("That file could not be saved: \(error.localizedDescription)") }
  }

  /* anything that changes under the project folder, the AI writing a file or git
     saving a checkpoint, is passed to the interface a quarter of a second later */
  private func watch() {
    if let s = stream { FSEventStreamStop(s); FSEventStreamInvalidate(s); FSEventStreamRelease(s); stream = nil }
    guard let root = root else { return }
    var ctx = FSEventStreamContext(version: 0, info: Unmanaged.passUnretained(self).toOpaque(),
                                   retain: nil, release: nil, copyDescription: nil)
    let cb: FSEventStreamCallback = { _, info, count, paths, _, _ in
      guard let info = info else { return }
      let me = Unmanaged<Project>.fromOpaque(info).takeUnretainedValue()
      guard let root = me.root else { return }
      let list = unsafeBitCast(paths, to: NSArray.self) as? [String] ?? []
      let rel = list.prefix(count).compactMap { p -> String? in
        guard p.hasPrefix(root.path) else { return nil }
        let r = String(p.dropFirst(root.path.count)).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if r.range(of: #"(^|/)(node_modules|\.next|dist|build)(/|$)"#, options: .regularExpression) != nil { return nil }
        if r.hasPrefix(".git/") && r.range(of: #"^\.git/(refs|HEAD|index|packed-refs)"#, options: .regularExpression) == nil { return nil }
        return r
      }
      if !rel.isEmpty { DispatchQueue.main.async { me.onChange?(rel) } }
    }
    stream = FSEventStreamCreate(nil, cb, &ctx, [root.path] as CFArray,
                                 FSEventStreamEventId(kFSEventStreamEventIdSinceNow), 0.25,
                                 FSEventStreamCreateFlags(kFSEventStreamCreateFlagUseCFTypes | kFSEventStreamCreateFlagFileEvents))
    if let s = stream {
      FSEventStreamSetDispatchQueue(s, DispatchQueue.main)
      FSEventStreamStart(s)
    }
  }
}

// ---------------------------------------------------------------- learning

/* Where you are, what you passed, skipped and keep getting wrong. One file on
   this Mac, the same for every project, and the same file the Node twin uses. */
enum Learn {
  static let file = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".config/ope/learn.json")
  static let course = URL(fileURLWithPath: Project.real(FileManager.default.homeDirectoryForCurrentUser.path) + "/Desktop/OPE Course")
  static let readme = "# OPE Course\n\nYour practice work from OPE, Learning while building. Every task has its own folder with task.md (what to do) and test.cjs (what OPE runs to check it). This folder is its own git history, so saving checkpoints here never touches your projects.\n"

  /* the folder, its own git history and a first save signed as OPE, so it works
     before git knows the person's name */
  static func startCourse(_ c: Project) -> String {
    let fm = FileManager.default
    try? fm.createDirectory(at: course, withIntermediateDirectories: true)
    if !fm.fileExists(atPath: course.appendingPathComponent(".git").path) {
      try? readme.write(to: course.appendingPathComponent("README.md"), atomically: true, encoding: .utf8)
      _ = c.git(["init"])
      _ = c.git(["add", "-A"])
      let p = Process()
      p.executableURL = URL(fileURLWithPath: "/usr/bin/git")
      p.arguments = ["-C", course.path, "-c", "user.name=OPE", "-c", "user.email=ope@localhost", "commit", "-m", "OPE Course: the start"]
      p.standardOutput = FileHandle.nullDevice
      p.standardError = FileHandle.nullDevice
      try? p.run(); p.waitUntilExit()
    }
    return course.path
  }
  static let runOK: Set<String> = ["node", "npm", "npx", "python3", "python", "pytest", "go", "cargo", "swift", "deno", "bun"]

  static func get() -> [String: Any] {
    guard let d = try? Data(contentsOf: file), let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { return ["data": [String: Any]()] }
    return ["data": j]
  }
  static func save(_ data: Any) throws {
    try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
    let d = try JSONSerialization.data(withJSONObject: data, options: [.prettyPrinted])
    try d.write(to: file, options: .atomic)
  }

  /* an app opened from the Dock has almost no PATH, so the places Node and
     friends are usually installed are added, the newest nvm one included */
  static func path() -> String {
    let home = FileManager.default.homeDirectoryForCurrentUser.path
    var dirs = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", home + "/.volta/bin", home + "/.bun/bin",
                home + "/.deno/bin", home + "/.cargo/bin", home + "/go/bin"]
    let nvm = home + "/.nvm/versions/node"
    if let v = try? FileManager.default.contentsOfDirectory(atPath: nvm).sorted(by: { $0.compare($1, options: .numeric) == .orderedDescending }).first {
      dirs.insert(nvm + "/" + v + "/bin", at: 0)
    }
    return (dirs + [ProcessInfo.processInfo.environment["PATH"] ?? ""]).joined(separator: ":")
  }

  /* a test, in the project folder: never a shell, never longer than a minute */
  static func run(_ args: [String], in root: URL) throws -> [String: Any] {
    guard let first = args.first, runOK.contains(first) else {
      throw OPEError("OPE only runs tests with " + runOK.sorted().joined(separator: ", ") + ".")
    }
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    p.arguments = args
    p.currentDirectoryURL = root
    var env = ProcessInfo.processInfo.environment
    env["PATH"] = path()
    p.environment = env
    let out = Pipe(), err = Pipe()
    p.standardOutput = out
    p.standardError = err
    var outData = Data(), errData = Data()
    let group = DispatchGroup()
    group.enter(); DispatchQueue.global().async { outData = out.fileHandleForReading.readDataToEndOfFile(); group.leave() }
    group.enter(); DispatchQueue.global().async { errData = err.fileHandleForReading.readDataToEndOfFile(); group.leave() }
    do { try p.run() } catch { throw OPEError("\(first) could not be started.") }
    var killed = false
    let timer = DispatchWorkItem { if p.isRunning { killed = true; p.terminate() } }
    DispatchQueue.global().asyncAfter(deadline: .now() + 60, execute: timer)
    p.waitUntilExit()
    timer.cancel()
    group.wait()
    var e = String(decoding: errData, as: UTF8.self)
    if killed { e += "\nStopped after a minute." }
    if p.terminationStatus == 127 { e += "\n\(first) is not installed on this Mac." }
    return ["code": Int(p.terminationStatus), "out": String(decoding: outData, as: UTF8.self), "err": e]
  }
}

struct OPEError: Error { let message: String; init(_ m: String) { message = m } }

// ---------------------------------------------------------------- the files inside the app

final class Bundled: NSObject, WKURLSchemeHandler {
  let base = Bundle.main.resourceURL!.appendingPathComponent("web")

  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    guard let url = task.request.url else { return }
    var path = url.path
    if path.isEmpty || path == "/" { path = "/index.html" }
    let file = base.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
    guard file.path.hasPrefix(base.path), let data = try? Data(contentsOf: file) else {
      task.didReceive(HTTPURLResponse(url: url, statusCode: 404, httpVersion: nil, headerFields: nil)!)
      task.didFinish(); return
    }
    let types = ["html": "text/html", "js": "text/javascript", "css": "text/css", "json": "application/json",
                 "svg": "image/svg+xml", "ttf": "font/ttf", "md": "text/markdown", "png": "image/png"]
    let type = types[file.pathExtension.lowercased()] ?? "application/octet-stream"
    task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil,
                                    headerFields: ["Content-Type": type, "Access-Control-Allow-Origin": "*"])!)
    task.didReceive(data)
    task.didFinish()
  }
  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

// ---------------------------------------------------------------- OPE Chat

/* OPE CHAT EXPLAINS. IT DOES NOT BUILD, FIX OR DEBUG.

   A free model small enough to run on a laptop reads and explains code well.
   Fixing and adding to an existing app is the hardest thing a model does, and a
   small one does it confidently and wrong. So OPE Chat promises the one thing
   it does well, and says so when asked for the rest.

   Two engines, both on this Mac, and the project never leaves it:
     1. Apple's own model, where the Mac has Apple Intelligence. Nothing to download.
     2. Qwen2.5 Coder 3B through Ollama, for every other Mac. A 1.9 GB download
        OPE starts for you once Ollama is installed. */
enum Chat {
  static let model = "qwen2.5-coder:3b"
  static let ollama = URL(string: "http://127.0.0.1:11434")!
  static var pulling: [String: Any]? = nil

  static let rules = """
  You are OPE Chat, a friendly assistant inside OPE, an app for people who build software \
  by talking to an AI coder and cannot read code themselves.
  Talk like a normal, helpful AI. Answer greetings, small talk, maths and general questions \
  directly and briefly, the way any assistant would. Do not mention the code unless the \
  person asks about it.
  When they ask about the code, explain what a file, a function or a line does, why it is \
  there and how it connects to the rest, in plain words a non programmer understands, and \
  explain any technical word the first time you use it. Use only the code you are shown.
  One limit: you never write code, rewrite it, suggest a fix or debug. If they ask for that, \
  say in one sentence that their AI coder can make the change.
  Only greet them if they greeted you. Keep answers short.
  """

  static func appleReady() -> Bool {
  #if arch(arm64) && canImport(FoundationModels)
    if #available(macOS 26, *) {
      if case .available = SystemLanguageModel.default.availability { return true }
    }
  #endif
    return false
  }

  static func ollamaInstalled() -> Bool {
    ["/usr/local/bin/ollama", "/opt/homebrew/bin/ollama", "/Applications/Ollama.app"]
      .contains { FileManager.default.fileExists(atPath: $0) }
  }

  /* nil when Ollama is not answering, otherwise whether the model is there */
  static func ollamaHasModel() async -> Bool? {
    var req = URLRequest(url: ollama.appendingPathComponent("api/tags"))
    req.timeoutInterval = 2
    guard let (data, _) = try? await URLSession.shared.data(for: req),
          let j = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
    let names = (j["models"] as? [[String: Any]] ?? []).compactMap { $0["name"] as? String }
    return names.contains { $0 == model || $0.hasPrefix(model) }
  }

  static func engine() async -> [String: Any] {
    if appleReady() { return ["engine": "apple", "label": "Apple Intelligence, on this Mac"] }
    switch await ollamaHasModel() {
    case .some(true): return ["engine": "ollama", "label": "Qwen2.5 Coder 3B, on this Mac"]
    case .some(false):
      var out: [String: Any] = ["engine": "need-model", "label": "Needs a 1.9 GB download"]
      if let p = pulling { out["pulling"] = p }
      return out
    case .none:
      return ollamaInstalled()
        ? ["engine": "start-ollama", "label": "Open Ollama to use OPE Chat"]
        : ["engine": "none", "label": "Needs Ollama, free, from ollama.com"]
    }
  }

  /* the code is cut to what the engine can read at once, with the question and
     the rules always kept whole */
  static func prompt(_ b: [String: Any], budget: Int) -> String {
    var head: [String] = []
    if let v = b["project"] as? String, !v.isEmpty { head.append("Project: \(v)") }
    if let v = b["version"] as? String, !v.isEmpty { head.append("Version picked: \(v)") }
    if let v = b["file"] as? String, !v.isEmpty { head.append("File open: \(v)") }
    if let v = b["lines"] as? String, !v.isEmpty { head.append("Lines selected: \(v)") }
    var code = b["code"] as? String ?? ""
    if code.count > budget { code = String(code.prefix(budget)) + "\n[the rest of the file was cut to fit]" }
    let q = b["question"] as? String ?? ""
    return head.joined(separator: "\n") + (code.isEmpty ? "" : "\n\nThe code they have open, for if they ask about it:\n```\n\(code)\n```") + "\n\nThe person says: \(q)"
  }

  static func ask(_ b: [String: Any]) async throws -> [String: Any] {
  #if arch(arm64) && canImport(FoundationModels)
    if #available(macOS 26, *), appleReady() {
      let session = LanguageModelSession(instructions: rules)
      do {
        let r = try await session.respond(to: prompt(b, budget: 7000))
        return ["answer": r.content, "engine": "apple"]
      } catch {
        /* a file too big for the small window, or a guardrail: say it plainly */
        let text = "\(error)"
        if text.localizedCaseInsensitiveContains("context") || text.localizedCaseInsensitiveContains("exceeded") {
          return ["answer": "That is more code than this model can read at once. Select the part you are asking about and ask again.", "engine": "apple"]
        }
        throw OPEError("Apple's model could not answer: \(text)")
      }
    }
  #endif
    guard await ollamaHasModel() == true else { throw OPEError("OPE Chat has no model on this Mac yet.") }
    var req = URLRequest(url: ollama.appendingPathComponent("api/chat"))
    req.httpMethod = "POST"
    req.timeoutInterval = 180
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try JSONSerialization.data(withJSONObject: [
      "model": model, "stream": false,
      "options": ["num_ctx": 8192, "temperature": 0.2],
      "messages": [["role": "system", "content": rules], ["role": "user", "content": prompt(b, budget: 18000)]]
    ])
    let (data, _) = try await URLSession.shared.data(for: req)
    let j = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    if let e = j?["error"] as? String { throw OPEError("Ollama could not answer: \(e)") }
    let answer = (j?["message"] as? [String: Any])?["content"] as? String ?? ""
    return ["answer": answer, "engine": "ollama"]
  }

  /* the 1.9 GB download, started once, reported through engine() as it goes */
  static func pull() {
    if pulling != nil { return }
    pulling = ["status": "starting", "completed": 0, "total": 0]
    Task {
      var req = URLRequest(url: ollama.appendingPathComponent("api/pull"))
      req.httpMethod = "POST"
      req.timeoutInterval = 3600
      req.httpBody = try? JSONSerialization.data(withJSONObject: ["model": model, "stream": true])
      do {
        let (bytes, _) = try await URLSession.shared.bytes(for: req)
        for try await line in bytes.lines {
          guard let j = try? JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any] else { continue }
          if let e = j["error"] as? String { pulling = ["status": "error", "error": e]; return }
          var p: [String: Any] = ["status": j["status"] as? String ?? ""]
          if let t = j["total"] as? Int { p["total"] = t }
          if let c = j["completed"] as? Int { p["completed"] = c }
          pulling = p
        }
        pulling = nil
      } catch {
        pulling = ["status": "error", "error": "The download stopped. Check Ollama is open and try again."]
      }
    }
  }
}

// ---------------------------------------------------------------- reading a picture

/* THE WORDS IN A PICTURE, READ ON THIS MAC.

   Seeing a picture takes a model most Macs cannot run. Reading the words in one
   does not: Apple's Vision text reader has been on every Mac since 2019, Intel
   ones too, with nothing to download. So a screenshot of an error, a note or a
   message becomes text, and the chat answers it with whichever model it has. */
enum Picture {
  static func read(_ dataURL: String) throws -> [String: Any] {
    let b64 = dataURL.components(separatedBy: ",").last ?? ""
    guard let data = Data(base64Encoded: b64, options: .ignoreUnknownCharacters),
          let src = CGImageSourceCreateWithData(data as CFData, nil),
          let image = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
      throw OPEError("That picture could not be opened.")
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.automaticallyDetectsLanguage = true
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    /* top to bottom, then left to right, so a screenshot reads in the order a person reads it */
    let rows = (request.results ?? []).compactMap { o -> (CGRect, String)? in
      guard let t = o.topCandidates(1).first?.string else { return nil }
      return (o.boundingBox, t)
    }.sorted { a, b in
      abs(a.0.midY - b.0.midY) > 0.01 ? a.0.midY > b.0.midY : a.0.minX < b.0.minX
    }
    let text = rows.map { $0.1 }.joined(separator: "\n")
    return ["text": text, "words": text.split(whereSeparator: { $0 == " " || $0 == "\n" }).count,
            "width": image.width, "height": image.height]
  }
}

/* ADD OPE TO THIS PROJECT. The short rules file every AI coder reads, and the
   full system as a folder it opens only when needed. Nothing the person already
   wrote is overwritten: an existing AGENTS.md or CLAUDE.md is added to, and a
   file already in ope-system is left as it is. Also reachable as
   `OPE --install <folder>`, so it can be scripted and checked. */
func installSystem(into root: URL) -> [String: [String]] {
    let fm = FileManager.default
    let src = Bundle.main.resourceURL!.appendingPathComponent("system")
    var added: [String] = [], kept: [String] = []
    let agentsSrc = (try? String(contentsOf: src.appendingPathComponent("AGENTS.md"), encoding: .utf8)) ?? ""
    let agents = root.appendingPathComponent("AGENTS.md")
    if let have = try? String(contentsOf: agents, encoding: .utf8) {
      if have.contains("(OPE)") { kept.append("AGENTS.md") }
      else { try? (have + "\n\n" + agentsSrc).write(to: agents, atomically: true, encoding: .utf8); added.append("AGENTS.md (added to yours)") }
    } else { try? agentsSrc.write(to: agents, atomically: true, encoding: .utf8); added.append("AGENTS.md") }
    let claude = root.appendingPathComponent("CLAUDE.md")
    if let have = try? String(contentsOf: claude, encoding: .utf8) {
      if have.contains("@AGENTS.md") { kept.append("CLAUDE.md") }
      else { try? (have + "\n\n@AGENTS.md\n").write(to: claude, atomically: true, encoding: .utf8); added.append("CLAUDE.md (added to yours)") }
    } else { try? "@AGENTS.md\n".write(to: claude, atomically: true, encoding: .utf8); added.append("CLAUDE.md") }
    let dest = root.appendingPathComponent("ope-system")
    if let e = fm.enumerator(at: src, includingPropertiesForKeys: [.isDirectoryKey]) {
      for case let u as URL in e {
        let rel = String(u.standardizedFileURL.path.dropFirst(src.standardizedFileURL.path.count + 1))
        if rel == "AGENTS.md" || rel == "CLAUDE.md" { continue }
        let to = dest.appendingPathComponent(rel)
        if (try? u.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true {
          try? fm.createDirectory(at: to, withIntermediateDirectories: true); continue
        }
        if fm.fileExists(atPath: to.path) { kept.append("ope-system/" + rel); continue }
        try? fm.createDirectory(at: to.deletingLastPathComponent(), withIntermediateDirectories: true)
        if (try? fm.copyItem(at: u, to: to)) != nil { added.append("ope-system/" + rel) }
      }
    }
    return ["added": added, "kept": kept]
}

// ---------------------------------------------------------------- the terminal

/* A REAL TERMINAL, NOT A COMMAND RUNNER.

   `Learn.run` starts one program and hands back what it printed. That is not a
   terminal: there is no prompt, no colour, no Ctrl+C, and a download that draws
   a progress bar draws nothing at all. So this opens a pty, the same device
   Terminal opens, and runs the person's own login shell on the other end of it.
   Everything then behaves the way it does in Terminal, because it is the same
   thing.

   One shell for each project folder, kept by its path, so looking at another
   screen, or opening another project and coming back, never loses a 1.9 GB
   pull. The page gets the output in base64, gathered up and sent at most every
   sixteenth of a second, so a fast build does not fire thousands of calls into
   the web view.

   OPE NEVER TYPES. Nothing in this file writes to the shell except ptyWrite,
   and ptyWrite carries only what the person pressed on the keyboard. */
final class Shell {
  static let cap = 200 * 1024        // the scrollback kept for coming back

  let root: String
  let shell: String
  private(set) var fd: Int32 = -1
  private(set) var pid: pid_t = -1
  private(set) var live = true

  private let lock = NSLock()
  private let io = DispatchQueue(label: "ope.pty.write")
  private var scroll = Data()
  private var pending = Data()
  private var flushing = false
  private var lastOut = Date.distantPast

  /* argv and the environment are built before the fork, because between the
     fork and the exec a child may only call the few things that are safe
     there, and allocating memory is not one of them */
  init(root: String, cols: Int, rows: Int) throws {
    self.root = root
    let path = ProcessInfo.processInfo.environment["SHELL"].flatMap { $0.isEmpty ? nil : $0 } ?? "/bin/zsh"
    self.shell = FileManager.default.isExecutableFile(atPath: path) ? path : "/bin/zsh"
    let name = (self.shell as NSString).lastPathComponent

    var env = ProcessInfo.processInfo.environment
    env["TERM"] = "xterm-256color"
    /* PATH is left alone on purpose. A login shell builds its own, so ollama,
       git and node are found exactly where the person finds them in Terminal */
    let cShell = strdup(self.shell)
    let cDir = strdup(root)
    /* the leading dash is how a shell is told it is a login shell */
    let argList: [UnsafeMutablePointer<CChar>?] = [strdup("-" + name), strdup("-i"), nil]
    let envList: [UnsafeMutablePointer<CChar>?] = env.map { strdup("\($0.key)=\($0.value)") } + [nil]
    let argv = UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>.allocate(capacity: argList.count)
    let envp = UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>.allocate(capacity: envList.count)
    for (i, v) in argList.enumerated() { argv[i] = v }
    for (i, v) in envList.enumerated() { envp[i] = v }

    var win = winsize(ws_row: UInt16(max(1, rows)), ws_col: UInt16(max(1, cols)), ws_xpixel: 0, ws_ypixel: 0)
    var master: Int32 = -1
    let child = forkpty(&master, nil, nil, &win)
    if child < 0 { throw OPEError("A terminal could not be opened on this Mac.") }
    if child == 0 {
      /* the child. Foundation turns some signals off for itself, and the shell
         needs them back or Ctrl+C reaches nothing */
      signal(SIGPIPE, SIG_DFL); signal(SIGINT, SIG_DFL); signal(SIGQUIT, SIG_DFL); signal(SIGTERM, SIG_DFL)
      _ = chdir(cDir)
      _ = execve(cShell, argv, envp)
      _exit(127)
    }
    pid = child
    fd = master
    _ = fcntl(fd, F_SETFD, FD_CLOEXEC)
    read()
  }

  // ------------------------------------------------------------ reading

  /* its own thread, never the main one, so a build printing as fast as it can
     cannot make the window stop drawing */
  private func read() {
    let fd = self.fd
    Thread.detachNewThread { [weak self] in
      var buf = [UInt8](repeating: 0, count: 65536)
      while true {
        let n = buf.withUnsafeMutableBytes { Darwin.read(fd, $0.baseAddress, 65536) }
        if n > 0 { self?.got(Data(buf[0..<n])); continue }
        if n < 0 && errno == EINTR { continue }
        break
      }
      self?.ended()
    }
  }

  private func got(_ d: Data) {
    lock.lock()
    scroll.append(d)
    if scroll.count > Shell.cap { scroll.removeFirst(scroll.count - Shell.cap) }
    pending.append(d)
    lastOut = Date()
    let first = !flushing
    if first { flushing = true }
    lock.unlock()
    /* gathered up: at most one message to the page every sixteenth of a second */
    if first { DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(16)) { [weak self] in self?.flush() } }
  }

  private func flush() {
    lock.lock()
    let d = pending
    pending = Data()
    flushing = false
    lock.unlock()
    if d.isEmpty { return }
    Term.shared.emit(["pty": ["data": d.base64EncodedString()]])
  }

  private func ended() {
    var status: Int32 = 0
    while waitpid(pid, &status, 0) < 0 && errno == EINTR {}
    let code = (status & 0x7f) == 0 ? Int((status >> 8) & 0xff) : Int(128 + (status & 0x7f))
    lock.lock(); live = false; lock.unlock()
    DispatchQueue.main.async {
      self.flush()
      Term.shared.emit(["pty": ["exit": code]])
      Term.shared.forget(self.root)
    }
  }

  // ------------------------------------------------------------ the page talking back

  /* the only way anything ever reaches the shell */
  func write(_ text: String) {
    guard live, fd >= 0 else { return }
    let data = Data(text.utf8)
    let fd = self.fd
    io.async {
      data.withUnsafeBytes { raw in
        var at = 0
        while at < raw.count {
          let n = Darwin.write(fd, raw.baseAddress!.advanced(by: at), raw.count - at)
          if n > 0 { at += n; continue }
          if n < 0 && errno == EINTR { continue }
          break
        }
      }
    }
  }

  func resize(cols: Int, rows: Int) {
    guard fd >= 0 else { return }
    var win = winsize(ws_row: UInt16(max(1, rows)), ws_col: UInt16(max(1, cols)), ws_xpixel: 0, ws_ypixel: 0)
    _ = ioctl(fd, TIOCSWINSZ, &win)
  }

  /* what came back since the shell started, cut to 200 KB from the front. The
     cut is moved past any half a letter, so a character split down the middle
     never reaches the page */
  var buffer: String {
    lock.lock(); var d = scroll; lock.unlock()
    while let b = d.first, b & 0xc0 == 0x80 { d.removeFirst() }
    return String(decoding: d, as: UTF8.self)
  }

  /* IS SOMETHING STILL RUNNING? The terminal itself knows: the pty hands the
     keyboard to whichever group of programs is in front, so when that is not
     the shell, the shell is waiting on something. Recent output is the fallback
     for the rare Mac where the pty will not say. */
  var running: Bool {
    guard live, fd >= 0 else { return false }
    let front = tcgetpgrp(fd)
    if front > 0 { return front != pid }
    return Date().timeIntervalSince(lastOut) < 2
  }

  func stop() {
    lock.lock(); live = false; lock.unlock()
    if pid > 0 {
      killpg(pid, SIGHUP)
      kill(pid, SIGKILL)
      var status: Int32 = 0
      _ = waitpid(pid, &status, WNOHANG)
    }
    if fd >= 0 { close(fd); fd = -1 }
  }
}

/* every shell there is, kept by the project folder it was started in */
final class Term {
  static let shared = Term()
  private var shells: [String: Shell] = [:]
  /* set by the app to the web view, the same way a file change is pushed */
  var push: (([String: Any]) -> Void)?

  func emit(_ ev: [String: Any]) { push?(ev) }
  func forget(_ root: String) { if shells[root]?.live == false { shells[root] = nil } }

  /* open, or come back to the one already there. Never two for one folder */
  func open(_ root: String, cols: Int, rows: Int) throws -> [String: Any] {
    if let s = shells[root], s.live {
      s.resize(cols: cols, rows: rows)
      return ["ok": true, "started": false, "cwd": root, "shell": s.shell, "buffer": s.buffer]
    }
    let s = try Shell(root: root, cols: cols, rows: rows)
    shells[root] = s
    return ["ok": true, "started": true, "cwd": root, "shell": s.shell, "buffer": ""]
  }

  func at(_ root: String) -> Shell? { let s = shells[root]; return s?.live == true ? s : nil }

  func close(_ root: String) {
    shells[root]?.stop()
    shells[root] = nil
  }

  func closeAll() {
    for (_, s) in shells { s.stop() }
    shells = [:]
  }
}

// ---------------------------------------------------------------- the bridge

final class Bridge: NSObject, WKScriptMessageHandlerWithReply {
  let project: Project
  /* the OPE Course folder on the Desktop: the same file and git commands as a
     project, pointed at the practice work instead (where: "course") */
  let course: Project = { let c = Project(); c.root = Learn.course; return c }()
  func at(_ body: [String: Any]) -> Project { (body["where"] as? String) == "course" ? course : project }
  weak var window: NSWindow?
  init(_ p: Project) { project = p }

  func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage,
                             replyHandler: @escaping (Any?, String?) -> Void) {
    guard let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else {
      replyHandler(["error": "Bad message."], nil); return
    }
    let reply: ([String: Any]) -> Void = { replyHandler($0, nil) }
    let fail: (String) -> Void = { replyHandler(["error": $0], nil) }

    switch cmd {
    case "hello":
      var root = project.root?.path ?? ""
      if root.isEmpty, let last = UserDefaults.standard.string(forKey: "last"),
         FileManager.default.fileExists(atPath: last), let opened = try? project.open(last) { root = opened }
      reply(["kind": "mac", "root": root, "recent": project.recent, "library": project.library])

    case "open":
      do { reply(["root": try project.open(body["path"] as? String ?? ""), "library": project.library]) } catch let e as OPEError { fail(e.message) } catch { fail("\(error)") }

    case "pick":
      let panel = NSOpenPanel()
      panel.canChooseDirectories = true
      panel.canChooseFiles = false
      panel.allowsMultipleSelection = false
      panel.prompt = "Open"
      panel.message = "Pick the folder your AI built the project in."
      let done: (NSApplication.ModalResponse) -> Void = { r in
        guard r == .OK, let url = panel.url else { reply(["root": ""]); return }
        do { reply(["root": try self.project.open(url.path), "library": self.project.library]) } catch { fail("That folder could not be opened.") }
      }
      if let w = window { panel.beginSheetModal(for: w, completionHandler: done) } else { done(panel.runModal()) }

    case "prompt":
      let url = Bundle.main.resourceURL!.appendingPathComponent("OPE-PROMPT.md")
      reply(["text": (try? String(contentsOf: url, encoding: .utf8)) ?? ""])

    case "git":
      let args = (body["args"] as? [Any] ?? []).map { "\($0)" }
      DispatchQueue.global(qos: .userInitiated).async {
        let r = self.at(body).git(args)
        DispatchQueue.main.async { reply(r) }
      }

    case "list":
      DispatchQueue.global(qos: .userInitiated).async {
        let files = self.project.list()
        DispatchQueue.main.async { reply(["files": files]) }
      }

    case "read":
      do { reply(try at(body).read(body["path"] as? String ?? "")) } catch let e as OPEError { fail(e.message) } catch { fail("\(error)") }

    case "write":
      do { try at(body).write(body["path"] as? String ?? "", body["text"] as? String ?? ""); reply(["ok": true]) }
      catch let e as OPEError { fail(e.message) } catch { fail("\(error)") }

    case "learnGet":
      reply(Learn.get())

    case "courseInit":
      reply(["path": Learn.startCourse(course)])

    case "courseOpen":
      do { NSWorkspace.shared.open(try course.inside(body["path"] as? String ?? "")); reply(["ok": true]) }
      catch let e as OPEError { fail(e.message) } catch { fail("\(error)") }

    case "learnSave":
      do { try Learn.save(body["data"] ?? [String: Any]()); reply(["ok": true]) } catch { fail("Your progress could not be saved.") }

    case "run":
      guard let root = at(body).root else { fail("Open a project first."); return }
      let args = (body["args"] as? [Any] ?? []).map { "\($0)" }
      DispatchQueue.global(qos: .userInitiated).async {
        do { let r = try Learn.run(args, in: root); DispatchQueue.main.async { reply(r) } }
        catch let e as OPEError { DispatchQueue.main.async { fail(e.message) } }
        catch { DispatchQueue.main.async { fail("The test could not run.") } }
      }

    case "log":
      FileHandle.standardError.write(("OPE: " + (body["text"] as? String ?? "") + "\n").data(using: .utf8)!)
      reply(["ok": true])

    case "libraryRemove":
      let path = body["path"] as? String ?? ""
      project.library = project.library.filter { ($0["path"] as? String) != path }
      reply(["items": project.library])

    case "chatEngine":
      Task { let r = await Chat.engine(); DispatchQueue.main.async { reply(r) } }

    case "chat":
      Task {
        do { let r = try await Chat.ask(body); DispatchQueue.main.async { reply(r) } }
        catch let e as OPEError { DispatchQueue.main.async { fail(e.message) } }
        catch { DispatchQueue.main.async { fail("OPE Chat could not answer: \(error.localizedDescription)") } }
      }

    case "chatPull":
      Chat.pull(); reply(["ok": true])

    case "readImage":
      let data = body["data"] as? String ?? ""
      DispatchQueue.global(qos: .userInitiated).async {
        do { let r = try Picture.read(data); DispatchQueue.main.async { reply(r) } }
        catch let e as OPEError { DispatchQueue.main.async { fail(e.message) } }
        catch { DispatchQueue.main.async { fail("The words in that picture could not be read.") } }
      }

    case "chatOpen":
      if let url = URL(string: body["url"] as? String ?? ""), ["https"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
      else { NSWorkspace.shared.open(URL(fileURLWithPath: "/Applications/Ollama.app")) }
      reply(["ok": true])

    case "install":
      guard let root = project.root else { fail("Open a project first."); return }
      reply(installSystem(into: root))

    /* THE TERMINAL. The person's own shell, in the project folder, on a real
       pty. Nothing here ever sends a command of its own: ptyWrite carries only
       what was pressed on the keyboard. */
    case "ptyOpen":
      guard let root = at(body).root?.path else { fail("Open a project first."); return }
      let cols = body["cols"] as? Int ?? 80, rows = body["rows"] as? Int ?? 24
      do { reply(try Term.shared.open(root, cols: cols, rows: rows)) }
      catch let e as OPEError { fail(e.message) } catch { fail("A terminal could not be opened.") }

    case "ptyWrite":
      guard let root = at(body).root?.path else { fail("Open a project first."); return }
      Term.shared.at(root)?.write(body["data"] as? String ?? "")
      reply(["ok": true])

    case "ptyResize":
      guard let root = at(body).root?.path else { fail("Open a project first."); return }
      Term.shared.at(root)?.resize(cols: body["cols"] as? Int ?? 80, rows: body["rows"] as? Int ?? 24)
      reply(["ok": true])

    case "ptyClose":
      if let root = at(body).root?.path { Term.shared.close(root) }
      reply(["ok": true])

    case "ptyState":
      let root = at(body).root?.path ?? ""
      let s = Term.shared.at(root)
      reply(["open": s != nil, "running": s?.running ?? false, "cwd": root])

    case "copy":
      NSPasteboard.general.clearContents()
      NSPasteboard.general.setString(body["text"] as? String ?? "", forType: .string)
      reply(["ok": true])

    default:
      fail("Unknown command \(cmd)")
    }
  }
}

// ---------------------------------------------------------------- the window

final class App: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
  var window: NSWindow!
  var web: WKWebView!
  let project = Project()
  lazy var bridge = Bridge(project)

  func applicationDidFinishLaunching(_ n: Notification) {
    menus()
    let cfg = WKWebViewConfiguration()
    cfg.setURLSchemeHandler(Bundled(), forURLScheme: SCHEME)
    cfg.userContentController.addScriptMessageHandler(bridge, contentWorld: .page, name: "ope")
    cfg.preferences.setValue(true, forKey: "developerExtrasEnabled")

    /* the laptop's own screen when there is one */
    let screen = NSScreen.screens.first(where: { $0.localizedName.localizedCaseInsensitiveContains("built-in") })
      ?? NSScreen.main ?? NSScreen.screens[0]
    let size = NSSize(width: min(1480, screen.visibleFrame.width - 80), height: min(920, screen.visibleFrame.height - 60))
    window = NSWindow(contentRect: NSRect(origin: .zero, size: size),
                      styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
                      backing: .buffered, defer: false, screen: screen)
    window.titlebarAppearsTransparent = true
    window.titleVisibility = .hidden
    window.backgroundColor = .black
    window.minSize = NSSize(width: 760, height: 520)
    window.title = "OPE"
    window.delegate = self
    window.setFrameAutosaveName("OPEMain")
    if !window.setFrameUsingName("OPEMain") {
      let f = screen.visibleFrame
      window.setFrameOrigin(NSPoint(x: f.midX - size.width / 2, y: f.midY - size.height / 2))
    }

    web = WKWebView(frame: .zero, configuration: cfg)
    web.setValue(false, forKey: "drawsBackground")
    web.navigationDelegate = self
    web.uiDelegate = self
    if #available(macOS 13.3, *) { web.isInspectable = true }
    window.contentView = web
    bridge.window = window

    project.onChange = { [weak self] paths in
      guard let self = self,
            let data = try? JSONSerialization.data(withJSONObject: ["paths": paths]),
            let json = String(data: data, encoding: .utf8) else { return }
      self.web.evaluateJavaScript("window.OPEBridge && OPEBridge.emit(\(json))", completionHandler: nil)
    }

    /* the terminal's output, gathered up and sent the same way */
    Term.shared.push = { [weak self] ev in
      guard let self = self,
            let data = try? JSONSerialization.data(withJSONObject: ev),
            let json = String(data: data, encoding: .utf8) else { return }
      self.web.evaluateJavaScript("window.OPEBridge && OPEBridge.emit(\(json))", completionHandler: nil)
    }

    web.load(URLRequest(url: HOME))
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { true }

  /* no shell outlives the app */
  func applicationWillTerminate(_ n: Notification) { Term.shared.closeAll() }

  /* A PAGE'S FILE PICKER DOES NOTHING IN A WEB VIEW UNLESS THE APP OPENS IT.

     The + in OPE Chat is an ordinary file input. Safari answers it with a panel;
     a WKWebView asks its owner, and with no answer the press did nothing at all. */
  func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
               initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
    let panel = NSOpenPanel()
    panel.canChooseFiles = true
    panel.canChooseDirectories = false
    panel.allowsMultipleSelection = parameters.allowsMultipleSelection
    panel.allowedContentTypes = [.image]
    panel.message = "Pick a picture. OPE reads the words in it."
    panel.prompt = "Add"
    panel.beginSheetModal(for: window) { r in completionHandler(r == .OK ? panel.urls : nil) }
  }

  /* Copy, paste and undo only reach the code view if the menu has them */
  func menus() {
    let main = NSMenu()
    let appItem = NSMenuItem(); main.addItem(appItem)
    let appMenu = NSMenu()
    appMenu.addItem(withTitle: "About OPE", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
    appMenu.addItem(.separator())
    appMenu.addItem(withTitle: "Hide OPE", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
    appMenu.addItem(withTitle: "Quit OPE", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    appItem.submenu = appMenu

    let editItem = NSMenuItem(); main.addItem(editItem)
    let edit = NSMenu(title: "Edit")
    edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
    let redo = edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
    redo.keyEquivalentModifierMask = [.command, .shift]
    edit.addItem(.separator())
    edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
    edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
    edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
    edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    editItem.submenu = edit

    let winItem = NSMenuItem(); main.addItem(winItem)
    let win = NSMenu(title: "Window")
    win.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
    win.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
    winItem.submenu = win
    NSApp.mainMenu = main
    NSApp.windowsMenu = win
  }
}

if let i = CommandLine.arguments.firstIndex(of: "--install"), i + 1 < CommandLine.arguments.count {
  let r = installSystem(into: URL(fileURLWithPath: Project.real(CommandLine.arguments[i + 1])))
  print("added \(r["added"]!.count), kept \(r["kept"]!.count)")
  exit(0)
}

let app = NSApplication.shared
let delegate = App()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
