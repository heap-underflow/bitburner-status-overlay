import { StatusContainer } from "/lib/ui/StatusContainer.js"
import { StatusBarText, StatusBarProgress } from "/lib/ui/StatusBar.js"



export function shorten(x, {precision=2, sep='', div=1000}={}){
    const labels =['', 'k', 'm', 'b', 't', 'q']
    for(var n=0; x > div; n++){ x/=div }
    return `${x.toFixed(precision)}${sep}${labels[n]}`
}

// NOTE: Accessing 'document' like this costs something crazy, like 25GB of RAM.  There's a free way
//  there, which you can replace this with, but I'll leave that to you.
const doc = document

function cleanUp(){
    (new StatusContainer(doc)).destroy()
}

// I don't actually use a hardcoded list like this, but I wanted the sample to work out of the box
const HOSTNAMES = ["ecorp","megacorp","b-and-a","blade","nwo","clarkinc","omnitek","4sigma",
    "kuai-gong","fulcrumtech","fulcrumassets","stormtech","defcomm","infocomm","helios","vitalife",
    "icarus","univ-energy","titan-labs","microdyne","taiyang-digital","galactic-cyber","aerocorp",
    "omnia","zb-def","applied-energetics","solaris","deltaone","global-pharm","nova-med","zeus-med",
    "unitalife","lexo-corp","rho-construction","alpha-ent","aevum-police","rothman-uni",
    "zb-institute","summit-uni","syscore","catalyst","the-hub","comptek","netlink","johnson-ortho",
    "n00dles","foodnstuff","sigma-cosmetics","joesguns","zer0","nectar-net","neo-net",
    "silver-helix","hong-fang-tea","harakiri-sushi","phantasy","max-hardware","omega-net",
    "crush-fitness","iron-gym","millenium-fitness","powerhouse-fitness","snap-fitness",
    "run4theh111z","I.I.I.I","avmnite-02h",".","CSEC","The-Cave","w0r1d_d43m0n","home"
]

const CHECK = (hover) => `<span style="font-size:0.9em; color:green; vertical-align:0.1em" title="${hover}">✔</span>`
const XFAIL = (hover) => `<span style="font-size:0.8em; color:red;   vertical-align:0.2em" title="${hover}">✘</span>`

/** @param {NS} ns **/
export async function main(ns) {
    function getRootedCount(){
        //const hosts = [new HostExtended(ns, 'home', []), ...Object.values(scan(ns, 20))].filter(h=>(!h.isPrivate()))
        const hosts = HOSTNAMES.filter(hn => ns.serverExists(hn))
        const rooted = hosts.filter(hn => ns.hasRootAccess(hn))
        return [rooted.length, hosts.length]
    }

    function gfree(){
        const hosts = HOSTNAMES.filter(hn => ns.serverExists(hn)).filter(hn => ns.hasRootAccess(hn))

        let memUsed = 0, memMax = 0
        hosts.forEach(hn => {
            memUsed += ns.getServerUsedRam(hn)
            memMax  += ns.getServerMaxRam(hn)
        })

        return [memUsed, memMax]
    }

    function countContracts(){
        const hosts = HOSTNAMES.filter(hn => ns.serverExists(hn)).filter(hn => ns.hasRootAccess(hn))
        const contracts = [].concat.apply([], hosts.map(hn=>ns.ls(hn, '.cct')))
        return contracts.length
    }


    // Cleanup now (if we're developing, we want to destroy any existing element and start fresh)
    cleanUp()

    // Set an atExit handler to cleanup on our way out (otherwise we'd see a stale overlay forever)
    ns.atExit(cleanUp)

    // Create a container -- location can either be 'drawer' or 'stats'
    let container = new StatusContainer(doc, {location:'stats'})

    // For 'drawer' we need this observer to save the container from React
    container.installObserver(doc)

    // Just a set of status bars -- doesn't need to be in an object like this, but it cleans up the
    //  namespace a bit.  Note, since you don't have the corresponding scripts to run in the click
    //  handlers, they won't work for you.  But I'm leaving them there as examples of how you'd
    //  specify them.  Note that click handlers must be functions.
    //  So you can't write:
    //      clickHandler:ns.run(<some script>)
    //  Instead, you'd write:
    //      clickHandler: () => ns.run(<some script>)
    //  with arrow functions, or
    //      clickHandler: function(){ ns.run(<some script>) }
    //  using the boring old syntax.
    let bars = {
        hlev:   new StatusBarProgress(doc, {container, labelText: 'targets', clickHandler:() => ns.run("/tools/peers.js"), barColor:'#273061'}),
        home:   new StatusBarProgress(doc, {container, labelText:'home'}),
        gmem:   new StatusBarProgress(doc, {container, labelText:'global'}),
        exes:   new StatusBarText(doc, {container, labelText: 'EXEs'}),
        cont:   new StatusBarText(doc, {container, labelText: 'Contracts', clickHandler:() => ns.run("contract-hunter.js", 1, "--solve", "ALL")}),
        income: new StatusBarText(doc, {container, labelText: 'Income'}),
        xpgain: new StatusBarText(doc, {container, labelText: 'Experience'}),
    }

    // Instead of a while(true) loop -- which would work -- we use this infinite for loop counter.
    //  It lets us do the iteration check and throttle the update rate of the different bars.
    //  Not strictly necessary, but will help performance.
    for(let iteration=0;;iteration++){
        // Hacking Targets
        if((iteration % 50) == 0){
            let [rootedAvail, rootedMax] = getRootedCount()
            bars.hlev.progress = rootedAvail / rootedMax
            bars.hlev.llabel   = ns.sprintf("%d / %d", rootedAvail, rootedMax)
        }

        // Memory
        let [hused, hmax] = [ns.getServerUsedRam('home'), ns.getServerMaxRam('home')]
        let [gused, gmax] = gfree()
        bars.home.progress = hused / hmax
        bars.gmem.progress = gused / gmax

        // Unlockers
        if((iteration % 100) == 0){
            let exesContent = []
            for(let filename of ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe']){
                exesContent.push(ns.fileExists(filename) ? CHECK(filename) : XFAIL(filename))
            }
            bars.exes.rlabel = exesContent.join(" ")
        }

        // Contracts
        if((iteration % 50) == 0){
            bars.cont.rlabel = countContracts()
        }

        // Income & Experience
        let [incomePerSecond, incomeSinceReset] = ns.getScriptIncome()
        let experiencePerSecond = ns.getScriptExpGain()
        bars.income.rlabel = shorten(incomePerSecond)
        bars.xpgain.rlabel = shorten(experiencePerSecond)

        // Important: this must be asleep and not sleep if we want our clickHandlers to work.
        await ns.asleep(500)
    }
}
