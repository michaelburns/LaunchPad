using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace LaunchPad.Models
{
    public class Script
    {
        public int Id { get; set; }

        [Required, StringLength(257)]
        public string Name { get; set; }
        public string Author { get; set; }
        public string LastOutput { get; set; }

        // Todo: should this be IEnumerable?
        public List<Job> Jobs { get; set; }

        public Category Category{ get; set; }
    }
}
