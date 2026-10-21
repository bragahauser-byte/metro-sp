import { test } from "node:test";
import assert from "node:assert/strict";
import { dayType, easter, fromLocal, holidayName, serviceTime } from "../lib/time/sao-paulo.ts";
import { boardingVerdict, transferVerdict } from "../lib/schedule/hours.ts";
import { loadSchedule } from "./helpers.ts";

const data = loadSchedule();
const at = (date: string, time: string) => serviceTime(fromLocal(date, time));

test("Páscoa e feriados móveis", () => {
  assert.equal(easter(2026), "2026-04-05");
  assert.equal(holidayName("2026-04-03"), "Sexta-feira Santa");
  assert.equal(holidayName("2026-06-04"), "Corpus Christi");
  assert.equal(holidayName("2026-11-20"), "Dia da Consciência Negra");
});

test("tipo de dia e dia de operação no fuso de São Paulo", () => {
  assert.equal(dayType("2026-10-20"), "util"); // terça
  assert.equal(dayType("2026-10-24"), "sabado");
  assert.equal(dayType("2026-10-25"), "domingo");
  assert.equal(dayType("2026-10-12"), "feriado");
  // 0h10 de quarta ainda é o dia de operação de terça.
  const t = at("2026-10-21", "00:10");
  assert.deepEqual(t, { date: "2026-10-20", tipo: "util", min: 24 * 60 + 10 });
  // O mesmo instante escrito em UTC (03:10Z) dá o mesmo resultado.
  assert.deepEqual(serviceTime(new Date("2026-10-21T03:10:00Z")), t);
});

test("Linha 1: abre 4h40 e cada estação fecha no seu horário", () => {
  assert.equal(boardingVerdict(data, "1", "jabaquara", at("2026-10-20", "04:30")).status, "fechado");
  assert.equal(boardingVerdict(data, "1", "jabaquara", at("2026-10-20", "04:40")).status, "aberto");
  // Jabaquara fecha 0h06; Sé, 0h29.
  assert.equal(boardingVerdict(data, "1", "jabaquara", at("2026-10-21", "00:10")).status, "fechado");
  assert.equal(boardingVerdict(data, "1", "se", at("2026-10-21", "00:10")).status, "aberto");
});

test("Linha 17: segunda a sábado 6h–22h; domingo fechada; feriado não verificado", () => {
  assert.equal(boardingVerdict(data, "17", "morumbi", at("2026-10-20", "12:00")).status, "aberto");
  assert.equal(boardingVerdict(data, "17", "morumbi", at("2026-10-20", "22:30")).status, "fechado");
  assert.equal(boardingVerdict(data, "17", "morumbi", at("2026-10-25", "12:00")).status, "fechado");
  assert.equal(boardingVerdict(data, "17", "morumbi", at("2026-11-02", "12:00")).status, "nao-verificado");
});

test("Linha 6: 10h–15h em dias úteis; depois da validade vira não verificado", () => {
  assert.equal(boardingVerdict(data, "6", "perdizes", at("2026-10-20", "11:00")).status, "aberto");
  assert.equal(boardingVerdict(data, "6", "perdizes", at("2026-10-20", "16:00")).status, "fechado");
  assert.equal(boardingVerdict(data, "6", "perdizes", at("2026-10-24", "11:00")).status, "fechado");
  assert.equal(boardingVerdict(data, "6", "perdizes", at("2027-02-01", "11:00")).status, "nao-verificado");
});

test("linhas sem horário oficial confirmado não herdam regras do Metrô", () => {
  for (const l of ["7", "10", "11", "12", "13"]) {
    assert.equal(boardingVerdict(data, l, "x", at("2026-10-20", "12:00")).status, "nao-verificado", `linha ${l}`);
  }
});

test("madrugada de sábado para domingo: não verificado (operação 24 h experimental)", () => {
  assert.equal(boardingVerdict(data, "1", "jabaquara", at("2026-10-25", "02:00")).status, "nao-verificado");
  assert.equal(boardingVerdict(data, "1", "jabaquara", at("2026-10-25", "03:30")).status, "nao-verificado");
});

test("transferências", () => {
  // Entre linhas do Metrô: só até 0h00.
  assert.equal(transferVerdict(data, ["se"], "1", "3", at("2026-10-20", "23:50")).status, "aberto");
  assert.equal(transferVerdict(data, ["se"], "1", "3", at("2026-10-21", "00:05")).status, "fechado");
  // Tatuapé ↔ Linha 11 em dia útil: 10h–17h e 20h–0h.
  assert.equal(transferVerdict(data, ["tatuape"], "3", "11", at("2026-10-20", "08:00")).status, "fechado");
  assert.equal(transferVerdict(data, ["tatuape"], "3", "11", at("2026-10-20", "11:00")).status, "aberto");
  assert.equal(transferVerdict(data, ["tatuape"], "3", "11", at("2026-10-24", "08:00")).status, "aberto");
  // Sem regra publicada: não verificado.
  assert.equal(transferVerdict(data, ["luz"], "10", "11", at("2026-10-20", "12:00")).status, "nao-verificado");
});

test("Motiva: Linhas 4 e 5 das 4h40 à 0h; Linhas 8 e 9 das 4h à 0h (página oficial)", () => {
  assert.equal(boardingVerdict(data, "4", "x", at("2026-10-20", "12:00")).status, "aberto");
  assert.equal(boardingVerdict(data, "5", "x", at("2026-10-25", "04:45")).status, "aberto");
  assert.notEqual(boardingVerdict(data, "4", "x", at("2026-10-20", "04:20")).status, "aberto");
  assert.equal(boardingVerdict(data, "8", "x", at("2026-10-20", "04:20")).status, "aberto");
  assert.notEqual(boardingVerdict(data, "9", "x", at("2026-10-21", "00:30")).status, "aberto");
});
