import sys

from likeness import relay

TASK = """id = "0009-test"
title = "A packet for the test"

[[stage]]
id = "write"
run = ["{py}", "-c", "open('made.txt', 'w').write('ok')"]
expect = ["made.txt"]

[[stage]]
id = "break"
run = ["{py}", "-c", "raise SystemExit(3)"]

[[stage]]
id = "after"
run = ["{py}", "-c", "print('never')"]
"""


ELSEWHERE = """id = "0010-test"

[[stage]]
id = "where"
cwd = "tool"
run = ["{py}", "-c", "import os; print(os.getcwd()); open('here.txt', 'w').write('x')"]
expect = ["tool/here.txt"]

[[stage]]
id = "root"
run = ["{py}", "-c", "import sys; print(sys.argv[1])", "{root}/relay"]
"""


def test_a_stage_can_run_in_a_folder_and_logs_do_not_carry_local_paths(tmp_path):
    packet = tmp_path / "relay" / "0010-test"
    packet.mkdir(parents=True)
    (tmp_path / "tool").mkdir()
    (packet / "task.toml").write_text(ELSEWHERE.replace("{py}", sys.executable.replace("\\", "/")), encoding="utf-8")
    status = relay.run("0010", root=tmp_path / "relay", cwd=tmp_path)
    assert [s["state"] for s in status["stages"]] == ["passed", "passed"] and status["finished"]
    assert relay.pending(tmp_path / "relay") == []
    where, root = ((packet / "out" / f"{name}.log").read_text(encoding="utf-8").strip().replace("\\", "/") for name in ("where", "root"))
    assert where == "./tool" and root == "./relay"


def test_a_failed_gate_stops_the_run_and_everything_is_written_down(tmp_path):
    packet = tmp_path / "relay" / "0009-test"
    packet.mkdir(parents=True)
    (packet / "task.toml").write_text(TASK.format(py=sys.executable.replace("\\", "/")), encoding="utf-8")
    assert [p.name for p in relay.pending(tmp_path / "relay")] == ["0009-test"]
    status = relay.run("0009", root=tmp_path / "relay", cwd=tmp_path)
    assert [(s["id"], s["state"]) for s in status["stages"]] == [("write", "passed"), ("break", "failed"), ("after", "not run")]
    assert status["stopped_at"] == "break" and not status["finished"]
    run_md = (packet / "out" / "RUN.md").read_text(encoding="utf-8")
    assert "Stopped at **break**" in run_md and "exit code 3" in run_md
    assert "Questions for Claude" in (packet / "REPORT.md").read_text(encoding="utf-8")
