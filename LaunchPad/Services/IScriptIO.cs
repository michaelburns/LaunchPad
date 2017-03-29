using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace LaunchPad.Services
{
    public interface IScriptIO
    {
        bool Write(string name, string text);
        string Read(string name);
        bool Delete(string name);
        string FileLocation(string name);
        bool ScriptExists(string name);
        Dictionary<string, string> ScriptParams(string name);
    }
}
