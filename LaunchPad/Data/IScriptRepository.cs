using LaunchPad.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace LaunchPad.Data
{
    public interface IScriptRepository
    {

        // Scripts
        IQueryable<Script> GetScripts();
        Script GetScriptById(int scriptId);
        void InsertScript(Script script);
        void DeleteScript(int scriptId);
        void UpdateScript(Script script);

        // Categories
        IQueryable<Category> GetCategories();
        

        // Jobs
        IQueryable<Job> GetJobs();
        Job GetJobById(int jobId);
        // Bypasses the EF change tracker — use during a running job to detect cancellation
        // requested through a separate scope (the controller's CancelRunningJob action).
        Status? GetJobStatusFresh(int jobId);
        void InsertJob(Job job);
        void DeleteJob(int jobId);
        void UpdateJob(Job job);

        void Save();
    }
}
