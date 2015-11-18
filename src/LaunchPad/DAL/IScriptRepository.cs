using LaunchPad.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace LaunchPad.DAL
{
    public interface IScriptRepository : IDisposable
    {
        //Scripts
        IEnumerable<Script> GetScripts();
        Script GetScriptById(int scriptId);
        void InsertScript(Script script);
        void DeleteScript(int scriptId);
        void UpdateScript(Script script);

        //Jobs
        IEnumerable<Job> GetJobs();
        Job GetJobById(int jobId);
        void InsertJob(Job job);
        void DeleteJob(int jobId);
        void UpdateJob(Job job);

        void Save();
    }
}
